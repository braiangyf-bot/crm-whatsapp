import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TAMANO_MAXIMO_ARCHIVO = 5 * 1024 * 1024;
const MAXIMO_FILAS = 10_000;
const TAMANO_LOTE = 500;
const MAXIMO_DETALLES = 200;

const ESTADOS_VALIDOS = new Set([
"pendiente",
"contactado",
"interesado",
"cliente",
"no_responde",
]);

type FilaNormalizada = {
fila: number;
nombre: string;
cedula: string;
telefono: string;
estado: string;
notas: string | null;
};

type DetalleImportacion = {
fila: number;
tipo: "invalida" | "duplicada";
motivo: string;
};

function normalizarEncabezado(valor: string): string {
  return valor
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function contarSeparadores(
linea: string,
separador: string
): number {
let cantidad = 0;
let dentroDeComillas = false;

for (let indice = 0; indice < linea.length; indice += 1) {
const caracter = linea[indice];


if (caracter === '"') {
  const siguiente = linea[indice + 1];

  if (dentroDeComillas && siguiente === '"') {
    indice += 1;
    continue;
  }

  dentroDeComillas = !dentroDeComillas;
  continue;
}

if (!dentroDeComillas && caracter === separador) {
  cantidad += 1;
}


}

return cantidad;
}

function detectarSeparador(texto: string): string {
const primeraLinea =
texto
.replace(/^\uFEFF/, "")
.split(/\r?\n/)
.find((linea) => linea.trim().length > 0) || "";

const candidatos = [",", ";", "\t"];

let mejorSeparador = ";";
let mayorCantidad = -1;

for (const separador of candidatos) {
const cantidad = contarSeparadores(
primeraLinea,
separador
);


if (cantidad > mayorCantidad) {
  mayorCantidad = cantidad;
  mejorSeparador = separador;
}


}

return mejorSeparador;
}

function parsearCsv(textoOriginal: string): string[][] {
const texto = textoOriginal.replace(/^\uFEFF/, "");
const separador = detectarSeparador(texto);

const filas: string[][] = [];

let filaActual: string[] = [];
let campoActual = "";
let dentroDeComillas = false;

for (let indice = 0; indice < texto.length; indice += 1) {
const caracter = texto[indice];

if (caracter === '"') {
  const siguiente = texto[indice + 1];

  if (dentroDeComillas && siguiente === '"') {
    campoActual += '"';
    indice += 1;
  } else {
    dentroDeComillas = !dentroDeComillas;
  }

  continue;
}

if (!dentroDeComillas && caracter === separador) {
  filaActual.push(campoActual.trim());
  campoActual = "";
  continue;
}

if (
  !dentroDeComillas &&
  (caracter === "\n" || caracter === "\r")
) {
  if (
    caracter === "\r" &&
    texto[indice + 1] === "\n"
  ) {
    indice += 1;
  }

  filaActual.push(campoActual.trim());
  campoActual = "";

  const tieneContenido = filaActual.some(
    (campo) => campo.trim().length > 0
  );

  if (tieneContenido) {
    filas.push(filaActual);
  }

  filaActual = [];
  continue;
}

campoActual += caracter;


}

filaActual.push(campoActual.trim());

const tieneContenido = filaActual.some(
(campo) => campo.trim().length > 0
);

if (tieneContenido) {
filas.push(filaActual);
}

return filas;
}

function obtenerIndice(
encabezados: string[],
nombresPermitidos: string[]
): number {
return encabezados.findIndex((encabezado) =>
nombresPermitidos.includes(encabezado)
);
}

function soloDigitos(valor: string): string {
return valor.replace(/\D/g, "");
}

function normalizarTelefono(
valor: string
): string | null {
const digitos = soloDigitos(valor);

if (/^3\d{9}$/.test(digitos)) {
return digitos;
}

if (/^573\d{9}$/.test(digitos)) {
return digitos.slice(2);
}

return null;
}

function dividirEnLotes<T>(
elementos: T[],
tamano: number
): T[][] {
const lotes: T[][] = [];

for (
let indice = 0;
indice < elementos.length;
indice += tamano
) {
lotes.push(
elementos.slice(indice, indice + tamano)
);
}

return lotes;
}

export async function POST(request: Request) {
try {
const formData = await request.formData();
const entradaArchivo = formData.get("archivo");

if (
  !entradaArchivo ||
  typeof entradaArchivo === "string"
) {
  return NextResponse.json(
    {
      error:
        "Debes seleccionar un archivo CSV.",
    },
    {
      status: 400,
    }
  );
}

const archivo = entradaArchivo;

if (archivo.size === 0) {
  return NextResponse.json(
    {
      error: "El archivo está vacío.",
    },
    {
      status: 400,
    }
  );
}

if (archivo.size > TAMANO_MAXIMO_ARCHIVO) {
  return NextResponse.json(
    {
      error:
        "El archivo supera el tamaño máximo permitido de 5 MB.",
    },
    {
      status: 400,
    }
  );
}

const nombreArchivo = archivo.name.toLowerCase();

if (!nombreArchivo.endsWith(".csv")) {
  return NextResponse.json(
    {
      error:
        "El archivo debe estar guardado en formato CSV.",
    },
    {
      status: 400,
    }
  );
}

const texto = await archivo.text();
const filas = parsearCsv(texto);

if (filas.length < 2) {
  return NextResponse.json(
    {
      error:
        "El CSV debe tener una fila de encabezados y al menos un cliente.",
    },
    {
      status: 400,
    }
  );
}

const encabezados = filas[0].map(
  normalizarEncabezado
);

const indiceNombre = obtenerIndice(
  encabezados,
  [
    "nombre",
    "nombres",
    "nombre_completo",
    "cliente",
    "nombre_cliente",
  ]
);

const indiceCedula = obtenerIndice(
  encabezados,
  [
    "cedula",
    "documento",
    "numero_documento",
    "numero_de_documento",
    "identificacion",
    "cc",
  ]
);

const indiceTelefono = obtenerIndice(
  encabezados,
  [
    "telefono",
    "celular",
    "movil",
    "whatsapp",
    "numero_telefono",
    "numero_de_telefono",
    "telefono_cliente",
  ]
);

const indiceEstado = obtenerIndice(
  encabezados,
  ["estado"]
);

const indiceNotas = obtenerIndice(
  encabezados,
  [
    "notas",
    "nota",
    "observaciones",
    "comentarios",
  ]
);

const columnasFaltantes: string[] = [];

if (indiceNombre === -1) {
  columnasFaltantes.push("nombre");
}

if (indiceCedula === -1) {
  columnasFaltantes.push("cedula");
}

if (indiceTelefono === -1) {
  columnasFaltantes.push("telefono");
}

if (columnasFaltantes.length > 0) {
  return NextResponse.json(
    {
      error: `Faltan columnas obligatorias: ${columnasFaltantes.join(
        ", "
      )}.`,
    },
    {
      status: 400,
    }
  );
}

const filasDeDatos = filas.slice(1);

if (filasDeDatos.length > MAXIMO_FILAS) {
  return NextResponse.json(
    {
      error:
        "El archivo contiene más de 10.000 filas. Divide la importación en varios archivos.",
    },
    {
      status: 400,
    }
  );
}

const detalles: DetalleImportacion[] = [];
const candidatos: FilaNormalizada[] = [];

const cedulasVistas = new Set<string>();
const telefonosVistos = new Set<string>();

filasDeDatos.forEach((fila, indice) => {
  const numeroFila = indice + 2;

  const nombre = String(
    fila[indiceNombre] || ""
  )
    .trim()
    .replace(/\s+/g, " ");

  const cedulaOriginal = String(
    fila[indiceCedula] || ""
  ).trim();

  const cedula = soloDigitos(cedulaOriginal);

  const telefono = normalizarTelefono(
    String(fila[indiceTelefono] || "")
  );

  const estadoOriginal =
    indiceEstado === -1
      ? ""
      : String(fila[indiceEstado] || "")
          .trim()
          .toLowerCase();

  const estado =
    estadoOriginal || "pendiente";

  const notas =
    indiceNotas === -1
      ? null
      : String(fila[indiceNotas] || "").trim() ||
        null;

  if (!nombre) {
    detalles.push({
      fila: numeroFila,
      tipo: "invalida",
      motivo: "El nombre está vacío.",
    });

    return;
  }

  if (!cedula) {
    detalles.push({
      fila: numeroFila,
      tipo: "invalida",
      motivo:
        "La cédula está vacía o no contiene números.",
    });

    return;
  }

  if (/[a-zA-Z]/.test(cedulaOriginal)) {
    detalles.push({
      fila: numeroFila,
      tipo: "invalida",
      motivo:
        "La cédula contiene letras.",
    });

    return;
  }

  if (!telefono) {
    detalles.push({
      fila: numeroFila,
      tipo: "invalida",
      motivo:
        "El teléfono no es un celular colombiano válido de 10 dígitos o 12 dígitos con prefijo 57.",
    });

    return;
  }

  if (!ESTADOS_VALIDOS.has(estado)) {
    detalles.push({
      fila: numeroFila,
      tipo: "invalida",
      motivo: `El estado "${estadoOriginal}" no es válido.`,
    });

    return;
  }

  if (cedulasVistas.has(cedula)) {
    detalles.push({
      fila: numeroFila,
      tipo: "duplicada",
      motivo:
        "La cédula está repetida dentro del archivo CSV.",
    });

    return;
  }

  if (telefonosVistos.has(telefono)) {
    detalles.push({
      fila: numeroFila,
      tipo: "duplicada",
      motivo:
        "El teléfono está repetido dentro del archivo CSV.",
    });

    return;
  }

  cedulasVistas.add(cedula);
  telefonosVistos.add(telefono);

  candidatos.push({
    fila: numeroFila,
    nombre,
    cedula,
    telefono,
    estado,
    notas,
  });
});

const cedulasExistentes = new Set<string>();
const telefonosExistentes = new Set<string>();

const lotesConsulta = dividirEnLotes(
  candidatos,
  TAMANO_LOTE
);

for (const lote of lotesConsulta) {
  const cedulas = lote.map(
    (cliente) => cliente.cedula
  );

  const telefonos = lote.flatMap(
    (cliente) => [
      cliente.telefono,
      `57${cliente.telefono}`,
    ]
  );

  const existentes =
    await prisma.clientes.findMany({
      where: {
        OR: [
          {
            cedula: {
              in: cedulas,
            },
          },
          {
            telefono: {
              in: telefonos,
            },
          },
        ],
      },
      select: {
        cedula: true,
        telefono: true,
      },
    });

  existentes.forEach((cliente) => {
    if (cliente.cedula) {
      cedulasExistentes.add(
        cliente.cedula
      );
    }

    if (cliente.telefono) {
      const telefonoNormalizado =
        normalizarTelefono(
          cliente.telefono
        );

      if (telefonoNormalizado) {
        telefonosExistentes.add(
          telefonoNormalizado
        );
      }
    }
  });
}

const clientesParaCrear =
  candidatos.filter((cliente) => {
    const cedulaDuplicada =
      cedulasExistentes.has(
        cliente.cedula
      );

    const telefonoDuplicado =
      telefonosExistentes.has(
        cliente.telefono
      );

    if (
      !cedulaDuplicada &&
      !telefonoDuplicado
    ) {
      return true;
    }

    const camposDuplicados: string[] = [];

    if (cedulaDuplicada) {
      camposDuplicados.push("cédula");
    }

    if (telefonoDuplicado) {
      camposDuplicados.push("teléfono");
    }

    detalles.push({
      fila: cliente.fila,
      tipo: "duplicada",
      motivo: `Ya existe un cliente con la misma ${camposDuplicados.join(
        " y "
      )}.`,
    });

    return false;
  });

let creados = 0;

const lotesCreacion = dividirEnLotes(
  clientesParaCrear,
  TAMANO_LOTE
);

for (const lote of lotesCreacion) {
  const resultado =
    await prisma.clientes.createMany({
      data: lote.map((cliente) => ({
        nombre: cliente.nombre,
        cedula: cliente.cedula,
        telefono: cliente.telefono,
        estado: cliente.estado,
        notas: cliente.notas,
      })),
      skipDuplicates: true,
    });

  creados += resultado.count;
}

const duplicadosDetectados =
  detalles.filter(
    (detalle) =>
      detalle.tipo === "duplicada"
  ).length;

const invalidos = detalles.filter(
  (detalle) =>
    detalle.tipo === "invalida"
).length;

const conflictosDuranteCreacion =
  clientesParaCrear.length - creados;

const duplicados =
  duplicadosDetectados +
  conflictosDuranteCreacion;

return NextResponse.json({
  mensaje:
    "Importación procesada correctamente.",

  resumen: {
    filasLeidas: filasDeDatos.length,
    creados,
    duplicados,
    invalidos,
  },

  detalles: detalles.slice(
    0,
    MAXIMO_DETALLES
  ),

  detallesLimitados:
    detalles.length > MAXIMO_DETALLES,
});


} catch (error) {
console.error(
"Error importando clientes:",
error
);

return NextResponse.json(
  {
    error:
      "No fue posible importar el archivo. Revisa su formato e inténtalo nuevamente.",
  },
  {
    status: 500,
  }
);

}
}
