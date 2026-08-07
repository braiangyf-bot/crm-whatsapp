import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_SOLICITUD = 50;
const TAMANO_BLOQUE_ENVIO = 20;

const ESTADOS_CLIENTE_PERMITIDOS = [
  "pendiente",
  "contactado",
  "interesado",
  "cliente",
  "no_responde",
] as const;

type EstadoCliente = (typeof ESTADOS_CLIENTE_PERMITIDOS)[number];

type ResultadoCliente = {
  cliente_id: string;
  nombre?: string;
  telefono?: string;
  ok: boolean;
  estado_api: string;
  whatsapp_message_id?: string | null;
  error?: unknown;
};

type RespuestaMeta = {
  ok: boolean;
  status: number;
  data: {
    messages?: Array<{
      id?: string;
      message_status?: string;
    }>;
    error?: unknown;
    [key: string]: unknown;
  };
};

function normalizarTelefonoColombia(
  telefono: string | null | undefined
): string | null {
  const limpio = String(telefono ?? "").replace(/\D/g, "");

  if (limpio.length === 10 && limpio.startsWith("3")) {
    return `57${limpio}`;
  }

  if (limpio.length === 12 && limpio.startsWith("57")) {
    return limpio;
  }

  return null;
}

function dividirEnBloques<T>(elementos: T[], tamano: number): T[][] {
  const bloques: T[][] = [];

  for (let indice = 0; indice < elementos.length; indice += tamano) {
    bloques.push(elementos.slice(indice, indice + tamano));
  }

  return bloques;
}

function normalizarListaTexto(valor: unknown): string[] {
  if (typeof valor === "string") {
    const texto = valor.trim();

    if (!texto) {
      return [];
    }

    try {
      return normalizarListaTexto(JSON.parse(texto));
    } catch {
      return [texto];
    }
  }

  if (!Array.isArray(valor)) {
    return [];
  }

  return valor
    .map((item) => String(item ?? "").trim())
    .filter((item) => item.length > 0);
}

function normalizarVariablesBody(valor: unknown): string[] {
  if (typeof valor === "string") {
    const texto = valor.trim();

    if (!texto) {
      return [];
    }

    try {
      return normalizarVariablesBody(JSON.parse(texto));
    } catch {
      return [texto];
    }
  }

  if (!Array.isArray(valor)) {
    return [];
  }

  return valor.map((item) => String(item ?? "").trim());
}

function normalizarNombresVariablesBody(valor: unknown): string[] {
  if (typeof valor === "string") {
    const texto = valor.trim();

    if (!texto) {
      return [];
    }

    try {
      return normalizarNombresVariablesBody(JSON.parse(texto));
    } catch {
      return /^[a-z0-9_]+$/.test(texto) ? [texto] : [];
    }
  }

  if (!Array.isArray(valor)) {
    return [];
  }

  return valor
    .map((item) => String(item ?? "").trim())
    .filter((nombre) => /^[a-z0-9_]+$/.test(nombre));
}

type ResultadoSubidaMedia =
  | {
      ok: true;
      mediaId: string;
      data: unknown;
    }
  | {
      ok: false;
      status: number;
      error: string;
      data: unknown;
    };

async function subirImagenHeaderMeta(
  archivo: File
): Promise<ResultadoSubidaMedia> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v25.0";

  if (!token) {
    return {
      ok: false,
      status: 500,
      error: "Falta WHATSAPP_TOKEN en las variables de entorno.",
      data: null,
    };
  }

  if (!phoneNumberId) {
    return {
      ok: false,
      status: 500,
      error: "Falta WHATSAPP_PHONE_NUMBER_ID en las variables de entorno.",
      data: null,
    };
  }

  const tipoArchivo = archivo.type || "";

  if (!["image/jpeg", "image/png"].includes(tipoArchivo)) {
    return {
      ok: false,
      status: 400,
      error: "La imagen del encabezado debe ser JPG o PNG.",
      data: {
        tipo_archivo: tipoArchivo,
      },
    };
  }

  if (archivo.size > 4 * 1024 * 1024) {
    return {
      ok: false,
      status: 400,
      error:
        "La imagen pesa más de 4 MB. Comprime la imagen antes de enviarla.",
      data: {
        tamano: archivo.size,
      },
    };
  }

  const formData = new FormData();

  formData.append("messaging_product", "whatsapp");
  formData.append("type", tipoArchivo);
  formData.append(
    "file",
    archivo,
    archivo.name || (tipoArchivo === "image/png" ? "header.png" : "header.jpg")
  );

  const respuesta = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  const data = await respuesta.json().catch(() => null);

  const mediaId =
    data && typeof data === "object" && "id" in data
      ? String((data as { id?: unknown }).id || "")
      : "";

  if (!respuesta.ok || !mediaId) {
    return {
      ok: false,
      status: respuesta.status,
      error: "Meta rechazó la subida de la imagen del encabezado.",
      data,
    };
  }

  return {
    ok: true,
    mediaId,
    data,
  };
}

type ClienteParaVariables = {
  nombre: string;
  telefono: string | null;
  estado: string | null;
};

function resolverVariablePlantilla(
  valor: string,
  cliente: ClienteParaVariables
): string {
  const limpio = valor.trim();

  if (
    limpio === "{nombre}" ||
    limpio === "{{nombre}}" ||
    limpio === "nombre" ||
    limpio === "nombre_cliente" ||
    limpio === "customer_name"
  ) {
    return cliente.nombre || "cliente";
  }

  if (
    limpio === "{telefono}" ||
    limpio === "{{telefono}}" ||
    limpio === "telefono" ||
    limpio === "telefono_cliente"
  ) {
    return cliente.telefono || "";
  }

  if (
    limpio === "{estado}" ||
    limpio === "{{estado}}" ||
    limpio === "estado" ||
    limpio === "estado_cliente"
  ) {
    return cliente.estado || "";
  }

  return limpio;
}

function construirVariablesBody({
  variableCount,
  valoresBase,
  cliente,
}: {
  variableCount: number;
  valoresBase: string[];
  cliente: ClienteParaVariables;
}): string[] {
  if (variableCount <= 0) {
    return [];
  }

  return Array.from({ length: variableCount }, (_, indice) => {
    const valorBase = valoresBase[indice]?.trim() ?? "";

    if (!valorBase && indice === 0) {
      return cliente.nombre || "cliente";
    }

    return resolverVariablePlantilla(valorBase, cliente);
  });
}

function validarVariablesBody({
  variableCount,
  valoresBase,
}: {
  variableCount: number;
  valoresBase: string[];
}): string | null {
  if (variableCount <= 1) {
    return null;
  }

  for (let indice = 1; indice < variableCount; indice += 1) {
    const valor = valoresBase[indice]?.trim();

    if (!valor) {
      return `Falta el valor para la variable {{${indice + 1}}}.`;
    }
  }

  return null;
}

type ParametroTextoPlantilla = {
  type: "text";
  text: string;
  parameter_name?: string;
};

type ParametroImagenPlantilla = {
  type: "image";
  image: {
    id: string;
  };
};

type ComponentePlantilla =
  | {
      type: "header";
      parameters: ParametroImagenPlantilla[];
    }
  | {
      type: "body";
      parameters: ParametroTextoPlantilla[];
    };

async function enviarPlantillaMeta({
  telefono,
  templateName,
  language,
  bodyVariables,
  bodyVariableNames,
  headerImageMediaId,
}: {
  telefono: string;
  templateName: string;
  language: string;
  bodyVariables: string[];
  bodyVariableNames: string[];
  headerImageMediaId?: string | null;
}): Promise<RespuestaMeta> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_API_VERSION || "v25.0";

  if (!token) {
    throw new Error("Falta WHATSAPP_TOKEN en las variables de entorno.");
  }

  if (!phoneNumberId) {
    throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID en las variables de entorno.");
  }

  const components: ComponentePlantilla[] = [];

  if (headerImageMediaId) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: {
            id: headerImageMediaId,
          },
        },
      ],
    });
  }

  if (bodyVariables.length > 0) {
    components.push({
      type: "body",
      parameters: bodyVariables.map((valor, indice): ParametroTextoPlantilla => {
        const parameterName = bodyVariableNames[indice]?.trim();

        if (parameterName && !/^\d+$/.test(parameterName)) {
          return {
            type: "text",
            parameter_name: parameterName,
            text: valor,
          };
        }

        return {
          type: "text",
          text: valor,
        };
      }),
    });
  }

  const template: {
    name: string;
    language: {
      code: string;
    };
    components?: ComponentePlantilla[];
  } = {
    name: templateName,
    language: {
      code: language,
    },
  };

  if (components.length > 0) {
    template.components = components;
  }

  const respuesta = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefono,
        type: "template",
        template,
      }),
    }
  );

  const data = (await respuesta.json()) as RespuestaMeta["data"];

  return {
    ok: respuesta.ok,
    status: respuesta.status,
    data,
  };
}

export async function POST(request: Request) {
  const autenticacion = await exigirUsuarioApi();

  if (!autenticacion.ok) {
    return autenticacion.response;
  }

  let loteId: string | null = null;

  try {
    const contentType = request.headers.get("content-type") || "";
    const esFormulario = contentType
      .toLowerCase()
      .includes("multipart/form-data");

    const formData = esFormulario ? await request.formData() : null;

    const body: unknown = formData
      ? Object.fromEntries(formData.entries())
      : await request.json();

    const archivoHeader = formData?.get("meta_header_image_file");

    const meta_header_image_file =
      archivoHeader instanceof File && archivoHeader.size > 0
        ? archivoHeader
        : null;

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        {
          ok: false,
          error: "El cuerpo de la solicitud no es válido.",
        },
        { status: 400 }
      );
    }

    const datos = body as Record<string, unknown>;

    const clienteIdsRecibidos = normalizarListaTexto(datos.cliente_ids);

    const clienteIds: string[] = Array.from(
      new Set<string>(clienteIdsRecibidos)
    );

    const mensajeEnviado = String(datos.mensaje_enviado ?? "").trim();

    const templateName = String(datos.meta_template_name ?? "").trim();

    const templateLanguage = String(
      datos.meta_template_language ?? "es"
    ).trim();

    const variableCount = Number(datos.meta_variable_count ?? 0);

    const bodyVariablesBase = normalizarVariablesBody(
      datos.meta_body_variables
    );

    const bodyVariableNames = normalizarNombresVariablesBody(
      datos.meta_variable_names
    );

    const metaHeaderFormat = String(datos.meta_header_format ?? "")
      .trim()
      .toUpperCase();

    const requiereImagenHeader =
      metaHeaderFormat === "IMAGE" ||
      templateName === "promocion_limpieza_facial";

    const estadoSolicitado = String(
      datos.nuevo_estado_cliente ?? "contactado"
    ).trim();

    const nuevoEstadoCliente: EstadoCliente =
      ESTADOS_CLIENTE_PERMITIDOS.includes(estadoSolicitado as EstadoCliente)
        ? (estadoSolicitado as EstadoCliente)
        : "contactado";

    if (clienteIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Debes seleccionar al menos un cliente.",
        },
        { status: 400 }
      );
    }

    if (clienteIds.length > LIMITE_SOLICITUD) {
      return NextResponse.json(
        {
          ok: false,
          error: `Solo se permiten máximo ${LIMITE_SOLICITUD} clientes por campaña.`,
        },
        { status: 400 }
      );
    }

    if (!templateName) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta meta_template_name.",
        },
        { status: 400 }
      );
    }

    if (!templateLanguage) {
      return NextResponse.json(
        {
          ok: false,
          error: "Falta meta_template_language.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(variableCount) ||
      variableCount < 0 ||
      variableCount > 20
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Solo se permiten plantillas entre 0 y 20 variables.",
        },
        { status: 400 }
      );
    }

    const errorVariablesBody = validarVariablesBody({
      variableCount,
      valoresBase: bodyVariablesBase,
    });

    if (errorVariablesBody) {
      return NextResponse.json(
        {
          ok: false,
          error: errorVariablesBody,
        },
        { status: 400 }
      );
    }

    let headerImageMediaId: string | null = null;

    if (requiereImagenHeader) {
      if (!meta_header_image_file) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Esta plantilla requiere una imagen de encabezado. Adjunta una imagen JPG o PNG antes de enviar el lote.",
            codigo: "template_header_image_required",
          },
          { status: 400 }
        );
      }

      const resultadoSubidaImagen = await subirImagenHeaderMeta(
        meta_header_image_file
      );

      if (!resultadoSubidaImagen.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: resultadoSubidaImagen.error,
            detalle: resultadoSubidaImagen.data,
            codigo: "template_header_image_upload_failed",
          },
          { status: resultadoSubidaImagen.status || 400 }
        );
      }

      headerImageMediaId = resultadoSubidaImagen.mediaId;
    }

    const clientes = await prisma.clientes.findMany({
      where: {
        id: {
          in: clienteIds,
        },
      },
      select: {
        id: true,
        nombre: true,
        telefono: true,
        estado: true,
      },
    });

    if (clientes.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se encontraron los clientes seleccionados.",
        },
        { status: 404 }
      );
    }

    const idsEncontrados = new Set<string>(
      clientes.map((cliente): string => cliente.id)
    );

    const idsNoEncontrados: string[] = clienteIds.filter(
      (id: string): boolean => !idsEncontrados.has(id)
    );

    const lote = await prisma.campanas_lotes.create({
      data: {
        nombre_plantilla: templateName,
        mensaje: mensajeEnviado || templateName,
        total_clientes: clienteIds.length,
        total_enviadas: 0,
        total_fallidas: idsNoEncontrados.length,
        estado: "procesando",
      },
    });

    loteId = lote.id;

    let totalEnviadas = 0;
    let totalFallidas = idsNoEncontrados.length;

    const resultados: ResultadoCliente[] = idsNoEncontrados.map(
      (clienteId: string): ResultadoCliente => ({
        cliente_id: clienteId,
        ok: false,
        estado_api: "client_not_found",
        error: "Cliente no encontrado.",
      })
    );

    const clientesBloqueadosPorNoResponde = clientes.filter(
      (cliente) => cliente.estado === "no_responde"
    );

    const clientesElegiblesPorEstado = clientes.filter(
      (cliente) => cliente.estado !== "no_responde"
    );

    for (const cliente of clientesBloqueadosPorNoResponde) {
      totalFallidas += 1;

      resultados.push({
        cliente_id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        ok: false,
        estado_api: "cliente_no_responde",
        error: "Cliente omitido porque está marcado como No responde.",
      });
    }

    const clientesParaEnviar = clientesElegiblesPorEstado;
    const bloquesClientes = dividirEnBloques(
      clientesParaEnviar,
      TAMANO_BLOQUE_ENVIO
    );

    for (const bloque of bloquesClientes) {
      for (const cliente of bloque) {
        const telefonoNormalizado = normalizarTelefonoColombia(
          cliente.telefono
        );

        if (!telefonoNormalizado) {
          const ahora = new Date();

          await prisma.campanas_enviadas.create({
            data: {
              cliente_id: cliente.id,
              plantilla_id: null,
              lote_id: lote.id,
              nombre_cliente: cliente.nombre,
              telefono_cliente: cliente.telefono,
              nombre_plantilla: templateName,
              mensaje_enviado: mensajeEnviado || templateName,
              estado: "fallida_api",
              canal: "api_oficial",
              whatsapp_message_id: null,
              estado_api: "invalid_phone",
              error_api: JSON.stringify({
                error: "Teléfono inválido. Debe ser un celular colombiano válido.",
                telefono_original: cliente.telefono,
              }),
              fecha_fallido: ahora,
            },
          });

          totalFallidas += 1;

          resultados.push({
            cliente_id: cliente.id,
            nombre: cliente.nombre,
            telefono: cliente.telefono,
            ok: false,
            estado_api: "invalid_phone",
            error: "Teléfono inválido.",
          });

          continue;
        }

        try {
          const bodyVariables = construirVariablesBody({
            variableCount,
            valoresBase: bodyVariablesBase,
            cliente: {
              nombre: cliente.nombre,
              telefono: cliente.telefono,
              estado: cliente.estado,
            },
          });

          const resultadoApi = await enviarPlantillaMeta({
            telefono: telefonoNormalizado,
            templateName,
            language: templateLanguage,
            bodyVariables,
            bodyVariableNames,
            headerImageMediaId,
          });

          if (resultadoApi.ok) {
            const whatsappMessageId =
              resultadoApi.data.messages?.[0]?.id ?? null;

            const estadoApi =
              resultadoApi.data.messages?.[0]?.message_status ?? "accepted";

            const ahora = new Date();

            await prisma.$transaction([
              prisma.campanas_enviadas.create({
                data: {
                  cliente_id: cliente.id,
                  plantilla_id: null,
                  lote_id: lote.id,
                  nombre_cliente: cliente.nombre,
                  telefono_cliente: telefonoNormalizado,
                  nombre_plantilla: templateName,
                  mensaje_enviado: mensajeEnviado || templateName,
                  estado: "enviada_api",
                  canal: "api_oficial",
                  whatsapp_message_id: whatsappMessageId,
                  estado_api: estadoApi,
                  error_api: null,
                  fecha_enviado_api: ahora,
                },
              }),

              prisma.clientes.update({
                where: {
                  id: cliente.id,
                },
                data: {
                  estado: nuevoEstadoCliente,
                  ultimo_contacto: ahora,
                },
              }),
            ]);

            totalEnviadas += 1;

            resultados.push({
              cliente_id: cliente.id,
              nombre: cliente.nombre,
              telefono: telefonoNormalizado,
              ok: true,
              estado_api: estadoApi,
              whatsapp_message_id: whatsappMessageId,
            });

            continue;
          }

          await prisma.campanas_enviadas.create({
            data: {
              cliente_id: cliente.id,
              plantilla_id: null,
              lote_id: lote.id,
              nombre_cliente: cliente.nombre,
              telefono_cliente: telefonoNormalizado,
              nombre_plantilla: templateName,
              mensaje_enviado: mensajeEnviado || templateName,
              estado: "fallida_api",
              canal: "api_oficial",
              whatsapp_message_id: null,
              estado_api: "failed",
              error_api: JSON.stringify(resultadoApi.data),
              fecha_fallido: new Date(),
            },
          });

          totalFallidas += 1;

          resultados.push({
            cliente_id: cliente.id,
            nombre: cliente.nombre,
            telefono: telefonoNormalizado,
            ok: false,
            estado_api: "failed",
            error: resultadoApi.data,
          });
        } catch (errorCliente) {
          const detalle =
            errorCliente instanceof Error
              ? errorCliente.message
              : String(errorCliente);

          await prisma.campanas_enviadas.create({
            data: {
              cliente_id: cliente.id,
              plantilla_id: null,
              lote_id: lote.id,
              nombre_cliente: cliente.nombre,
              telefono_cliente: telefonoNormalizado,
              nombre_plantilla: templateName,
              mensaje_enviado: mensajeEnviado || templateName,
              estado: "fallida_api",
              canal: "api_oficial",
              whatsapp_message_id: null,
              estado_api: "failed",
              error_api: JSON.stringify({
                error: detalle,
              }),
              fecha_fallido: new Date(),
            },
          });

          totalFallidas += 1;

          resultados.push({
            cliente_id: cliente.id,
            nombre: cliente.nombre,
            telefono: telefonoNormalizado,
            ok: false,
            estado_api: "failed",
            error: detalle,
          });
        }
      }
    }

    let estadoLote: "finalizado" | "finalizado_con_errores" | "fallido";

    if (totalFallidas === 0) {
      estadoLote = "finalizado";
    } else if (totalEnviadas > 0) {
      estadoLote = "finalizado_con_errores";
    } else {
      estadoLote = "fallido";
    }

    const loteActualizado = await prisma.campanas_lotes.update({
      where: {
        id: lote.id,
      },
      data: {
        total_enviadas: totalEnviadas,
        total_fallidas: totalFallidas,
        estado: estadoLote,
      },
    });

    return NextResponse.json({
      ok: true,
      mensaje: "El lote terminó de procesarse.",
      lote: {
        id: loteActualizado.id,
        nombre_plantilla: loteActualizado.nombre_plantilla,
        total_clientes: loteActualizado.total_clientes,
        total_enviadas: loteActualizado.total_enviadas,
        total_fallidas: loteActualizado.total_fallidas,
        estado: loteActualizado.estado,
      },
      enviadas: totalEnviadas,
      fallidas: totalFallidas,
      resultados,
    });
  } catch (error) {
    console.error("Error en /api/campanas/lote:", error);

    if (loteId) {
      try {
        await prisma.campanas_lotes.update({
          where: {
            id: loteId,
          },
          data: {
            estado: "fallido",
          },
        });
      } catch (errorActualizandoLote) {
        console.error(
          "No se pudo marcar el lote como fallido:",
          errorActualizandoLote
        );
      }
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Error interno procesando la campaña por lote.",
        detalle: error instanceof Error ? error.message : String(error),
        lote_id: loteId,
      },
      { status: 500 }
    );
  }
}