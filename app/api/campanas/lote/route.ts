import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { exigirUsuarioApi } from "@/lib/auth/exigirUsuarioApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMITE_SOLICITUD = 50;
const TAMANO_BLOQUE_ENVIO = 20;
const DIAS_BLOQUEO_REENVIO = 7;

const ESTADOS_CLIENTE_PERMITIDOS = [
  "pendiente",
  "contactado",
  "interesado",
  "cliente",
  "no_responde",
] as const;

type EstadoCliente =
  (typeof ESTADOS_CLIENTE_PERMITIDOS)[number];

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

function dividirEnBloques<T>(
  elementos: T[],
  tamano: number
): T[][] {
  const bloques: T[][] = [];

  for (
    let indice = 0;
    indice < elementos.length;
    indice += tamano
  ) {
    bloques.push(
      elementos.slice(indice, indice + tamano)
    );
  }

  return bloques;
}

function calcularFechaLimiteDuplicados(): Date {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - DIAS_BLOQUEO_REENVIO);
  return fecha;
}

async function enviarPlantillaMeta({
  telefono,
  templateName,
  language,
  variableCount,
  nombreCliente,
}: {
  telefono: string;
  templateName: string;
  language: string;
  variableCount: number;
  nombreCliente: string;
}): Promise<RespuestaMeta> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version =
    process.env.WHATSAPP_API_VERSION || "v25.0";

  if (!token) {
    throw new Error(
      "Falta WHATSAPP_TOKEN en las variables de entorno."
    );
  }

  if (!phoneNumberId) {
    throw new Error(
      "Falta WHATSAPP_PHONE_NUMBER_ID en las variables de entorno."
    );
  }

  const template: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: "body";
      parameters: Array<{
        type: "text";
        text: string;
      }>;
    }>;
  } = {
    name: templateName,
    language: {
      code: language,
    },
  };

  if (variableCount === 1) {
    template.components = [
      {
        type: "body",
        parameters: [
          {
            type: "text",
            text: nombreCliente || "cliente",
          },
        ],
      },
    ];
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
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "El cuerpo de la solicitud no es válido.",
        },
        { status: 400 }
      );
    }

    const datos = body as Record<string, unknown>;

    /*
     * Se convierten explícitamente los identificadores
     * recibidos en un arreglo string[].
     */
    const clienteIdsRecibidos: string[] = Array.isArray(
      datos.cliente_ids
    )
      ? datos.cliente_ids
        .map((id: unknown): string =>
          String(id ?? "").trim()
        )
        .filter((id: string): boolean => id.length > 0)
      : [];

    const clienteIds: string[] = Array.from(
      new Set<string>(clienteIdsRecibidos)
    );

    const mensajeEnviado = String(
      datos.mensaje_enviado ?? ""
    ).trim();

    const templateName = String(
      datos.meta_template_name ?? ""
    ).trim();

    const templateLanguage = String(
      datos.meta_template_language ?? "es"
    ).trim();

    const variableCount = Number(
      datos.meta_variable_count ?? 0
    );

    const estadoSolicitado = String(
      datos.nuevo_estado_cliente ?? "contactado"
    ).trim();

    const nuevoEstadoCliente: EstadoCliente =
      ESTADOS_CLIENTE_PERMITIDOS.includes(
        estadoSolicitado as EstadoCliente
      )
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
      ![0, 1].includes(variableCount)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Solo se permiten plantillas con 0 o 1 variable.",
        },
        { status: 400 }
      );
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
      },
    });

    if (clientes.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se encontraron los clientes seleccionados.",
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

    const resultados: ResultadoCliente[] =
      idsNoEncontrados.map(
        (clienteId: string): ResultadoCliente => ({
          cliente_id: clienteId,
          ok: false,
          estado_api: "client_not_found",
          error: "Cliente no encontrado.",
        })
      );

    const fechaLimiteDuplicados = calcularFechaLimiteDuplicados();

    const campanasRecientes =
      await prisma.campanas_enviadas.findMany({
        where: {
          cliente_id: {
            in: clientes.map((cliente) => cliente.id),
          },
          nombre_plantilla: templateName,
          estado: {
            not: "fallida_api",
          },
          OR: [
            {
              fecha_enviado_api: {
                gte: fechaLimiteDuplicados,
              },
            },
            {
              created_at: {
                gte: fechaLimiteDuplicados,
              },
            },
          ],
        },
        select: {
          cliente_id: true,
          created_at: true,
          fecha_enviado_api: true,
          nombre_plantilla: true,
          estado: true,
          estado_api: true,
        },
      });

    const clientesConCampanaReciente = new Set(
      campanasRecientes.map((campana) => campana.cliente_id),
    );

    const clientesParaEnviar = clientes.filter(
      (cliente) => !clientesConCampanaReciente.has(cliente.id),
    );

    const clientesOmitidosPorDuplicado = clientes.filter(
      (cliente) => clientesConCampanaReciente.has(cliente.id),
    );

    for (const cliente of clientesOmitidosPorDuplicado) {
      totalFallidas += 1;

      resultados.push({
        cliente_id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        ok: false,
        estado_api: "campana_duplicada_reciente",
        error: `Ya recibió la plantilla "${templateName}" en los últimos ${DIAS_BLOQUEO_REENVIO} días.`,
      });
    }

    const bloquesClientes = dividirEnBloques(
      clientesParaEnviar,
      TAMANO_BLOQUE_ENVIO,
    );

    for (const bloque of bloquesClientes) {
      for (const cliente of bloque) {
        const telefonoNormalizado =
          normalizarTelefonoColombia(cliente.telefono);

        /*
         * Teléfono inválido.
         */
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
              mensaje_enviado:
                mensajeEnviado || templateName,
              estado: "fallida_api",
              canal: "api_oficial",
              whatsapp_message_id: null,
              estado_api: "invalid_phone",
              error_api: JSON.stringify({
                error:
                  "Teléfono inválido. Debe ser un celular colombiano válido.",
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
          const resultadoApi = await enviarPlantillaMeta({
            telefono: telefonoNormalizado,
            templateName,
            language: templateLanguage,
            variableCount,
            nombreCliente: cliente.nombre,
          });

          /*
           * Meta aceptó el envío.
           */
          if (resultadoApi.ok) {
            const whatsappMessageId =
              resultadoApi.data.messages?.[0]?.id ?? null;

            const estadoApi =
              resultadoApi.data.messages?.[0]
                ?.message_status ?? "accepted";

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
                  mensaje_enviado:
                    mensajeEnviado || templateName,
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

          /*
           * Meta rechazó el envío.
           */
          await prisma.campanas_enviadas.create({
            data: {
              cliente_id: cliente.id,
              plantilla_id: null,
              lote_id: lote.id,
              nombre_cliente: cliente.nombre,
              telefono_cliente: telefonoNormalizado,
              nombre_plantilla: templateName,
              mensaje_enviado:
                mensajeEnviado || templateName,
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
              mensaje_enviado:
                mensajeEnviado || templateName,
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

    let estadoLote:
      | "finalizado"
      | "finalizado_con_errores"
      | "fallido";

    if (totalFallidas === 0) {
      estadoLote = "finalizado";
    } else if (totalEnviadas > 0) {
      estadoLote = "finalizado_con_errores";
    } else {
      estadoLote = "fallido";
    }

    const loteActualizado =
      await prisma.campanas_lotes.update({
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
        nombre_plantilla:
          loteActualizado.nombre_plantilla,
        total_clientes:
          loteActualizado.total_clientes,
        total_enviadas:
          loteActualizado.total_enviadas,
        total_fallidas:
          loteActualizado.total_fallidas,
        estado: loteActualizado.estado,
      },
      enviadas: totalEnviadas,
      fallidas: totalFallidas,
      resultados,
    });
  } catch (error) {
    console.error(
      "Error en /api/campanas/lote:",
      error
    );

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
        error:
          "Error interno procesando la campaña por lote.",
        detalle:
          error instanceof Error
            ? error.message
            : String(error),
        lote_id: loteId,
      },
      { status: 500 }
    );
  }
}