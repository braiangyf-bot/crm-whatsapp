BEGIN;

-- =========================================================
-- 1. NÚMEROS DE WHATSAPP CLOUD API
-- No se almacenan tokens ni secretos en esta tabla.
-- =========================================================

CREATE TABLE public.numeros_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  phone_number_id text NOT NULL,
  waba_id text,
  nombre text,
  telefono_mostrado text,

  activo boolean NOT NULL DEFAULT true,
  es_predeterminado boolean NOT NULL DEFAULT false,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT numeros_whatsapp_phone_number_id_unico
    UNIQUE (phone_number_id),

  CONSTRAINT numeros_whatsapp_phone_number_id_no_vacio
    CHECK (btrim(phone_number_id) <> ''),

  CONSTRAINT numeros_whatsapp_telefono_valido
    CHECK (
      telefono_mostrado IS NULL
      OR telefono_mostrado ~ '^\+?[0-9]{7,20}$'
    )
);

CREATE INDEX numeros_whatsapp_activo_idx
  ON public.numeros_whatsapp (activo);

CREATE UNIQUE INDEX numeros_whatsapp_unico_predeterminado_idx
  ON public.numeros_whatsapp (es_predeterminado)
  WHERE es_predeterminado = true;


-- =========================================================
-- 2. CONVERSACIONES
-- Una conversación por número empresarial y teléfono cliente.
-- =========================================================

CREATE TABLE public.conversaciones_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  numero_whatsapp_id uuid NOT NULL,
  cliente_id uuid,

  telefono_cliente text NOT NULL,
  nombre_cliente text,

  ultimo_mensaje text,
  ultimo_tipo text,
  ultima_direccion text,

  fecha_ultimo_mensaje timestamptz,
  fecha_ultimo_mensaje_entrante timestamptz,
  fecha_ultimo_mensaje_saliente timestamptz,

  ventana_atencion_hasta timestamptz,

  no_leidos integer NOT NULL DEFAULT 0,
  fecha_leida_internamente timestamptz,

  estado text NOT NULL DEFAULT 'abierta',
  asignado_a uuid,
  cerrada_at timestamptz,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT conversaciones_whatsapp_numero_fk
    FOREIGN KEY (numero_whatsapp_id)
    REFERENCES public.numeros_whatsapp (id)
    ON DELETE RESTRICT
    ON UPDATE NO ACTION,

  CONSTRAINT conversaciones_whatsapp_cliente_fk
    FOREIGN KEY (cliente_id)
    REFERENCES public.clientes (id)
    ON DELETE SET NULL
    ON UPDATE NO ACTION,

  CONSTRAINT conversaciones_whatsapp_numero_telefono_unico
    UNIQUE (numero_whatsapp_id, telefono_cliente),

  CONSTRAINT conversaciones_whatsapp_telefono_valido
    CHECK (telefono_cliente ~ '^[0-9]{7,20}$'),

  CONSTRAINT conversaciones_whatsapp_no_leidos_valido
    CHECK (no_leidos >= 0),

  CONSTRAINT conversaciones_whatsapp_estado_valido
    CHECK (
      estado IN (
        'abierta',
        'cerrada',
        'archivada'
      )
    ),

  CONSTRAINT conversaciones_whatsapp_ultima_direccion_valida
    CHECK (
      ultima_direccion IS NULL
      OR ultima_direccion IN ('entrante', 'saliente')
    )
);

CREATE INDEX conversaciones_whatsapp_cliente_idx
  ON public.conversaciones_whatsapp (cliente_id);

CREATE INDEX conversaciones_whatsapp_estado_idx
  ON public.conversaciones_whatsapp (estado);

CREATE INDEX conversaciones_whatsapp_actividad_idx
  ON public.conversaciones_whatsapp (
    fecha_ultimo_mensaje DESC NULLS LAST
  );

CREATE INDEX conversaciones_whatsapp_no_leidos_idx
  ON public.conversaciones_whatsapp (
    fecha_ultimo_mensaje DESC NULLS LAST
  )
  WHERE no_leidos > 0;

CREATE INDEX conversaciones_whatsapp_telefono_idx
  ON public.conversaciones_whatsapp (telefono_cliente);

CREATE INDEX conversaciones_whatsapp_nombre_idx
  ON public.conversaciones_whatsapp (
    lower(nombre_cliente)
  );


-- =========================================================
-- 3. MENSAJES
-- Preparada para texto, multimedia, plantillas y campañas.
-- =========================================================

CREATE TABLE public.mensajes_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  conversacion_id uuid NOT NULL,
  campana_enviada_id uuid,

  whatsapp_message_id text,
  idempotency_key text,
  context_message_id text,

  direccion text NOT NULL,
  tipo text NOT NULL DEFAULT 'text',
  origen text NOT NULL DEFAULT 'cliente',

  contenido text,
  caption text,

  estado_api text,
  error_api jsonb,

  fecha_mensaje timestamptz NOT NULL DEFAULT now(),
  timestamp_meta timestamptz,

  fecha_aceptado timestamptz,
  fecha_enviado timestamptz,
  fecha_entregado timestamptz,
  fecha_leido timestamptz,
  fecha_fallido timestamptz,

  fecha_leido_internamente timestamptz,

  media_id text,
  mime_type text,
  nombre_archivo text,
  tamano_archivo bigint,

  template_name text,
  template_language text,

  enviado_por_usuario_id uuid,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT mensajes_whatsapp_conversacion_fk
    FOREIGN KEY (conversacion_id)
    REFERENCES public.conversaciones_whatsapp (id)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,

  CONSTRAINT mensajes_whatsapp_campana_fk
    FOREIGN KEY (campana_enviada_id)
    REFERENCES public.campanas_enviadas (id)
    ON DELETE SET NULL
    ON UPDATE NO ACTION,

  CONSTRAINT mensajes_whatsapp_wamid_unico
    UNIQUE (whatsapp_message_id),

  CONSTRAINT mensajes_whatsapp_idempotency_unico
    UNIQUE (idempotency_key),

  CONSTRAINT mensajes_whatsapp_campana_unica
    UNIQUE (campana_enviada_id),

  CONSTRAINT mensajes_whatsapp_direccion_valida
    CHECK (
      direccion IN ('entrante', 'saliente')
    ),

  CONSTRAINT mensajes_whatsapp_tipo_valido
    CHECK (
      tipo IN (
        'text',
        'image',
        'audio',
        'document',
        'video',
        'sticker',
        'location',
        'contacts',
        'interactive',
        'reaction',
        'button',
        'order',
        'system',
        'template',
        'unknown'
      )
    ),

  CONSTRAINT mensajes_whatsapp_origen_valido
    CHECK (
      origen IN (
        'cliente',
        'respuesta_libre',
        'plantilla',
        'campana',
        'sistema'
      )
    ),

  CONSTRAINT mensajes_whatsapp_entrante_con_wamid
    CHECK (
      direccion <> 'entrante'
      OR whatsapp_message_id IS NOT NULL
    ),

  CONSTRAINT mensajes_whatsapp_texto_con_contenido
    CHECK (
      tipo <> 'text'
      OR nullif(btrim(contenido), '') IS NOT NULL
    ),

  CONSTRAINT mensajes_whatsapp_tamano_valido
    CHECK (
      tamano_archivo IS NULL
      OR tamano_archivo >= 0
    )
);

CREATE INDEX mensajes_whatsapp_conversacion_fecha_idx
  ON public.mensajes_whatsapp (
    conversacion_id,
    fecha_mensaje DESC
  );

CREATE INDEX mensajes_whatsapp_estado_idx
  ON public.mensajes_whatsapp (
    direccion,
    estado_api
  );

CREATE INDEX mensajes_whatsapp_contexto_idx
  ON public.mensajes_whatsapp (context_message_id);

CREATE INDEX mensajes_whatsapp_campana_idx
  ON public.mensajes_whatsapp (campana_enviada_id);

CREATE INDEX mensajes_whatsapp_entrantes_no_leidos_idx
  ON public.mensajes_whatsapp (
    conversacion_id,
    fecha_mensaje DESC
  )
  WHERE direccion = 'entrante'
    AND fecha_leido_internamente IS NULL;


-- =========================================================
-- 4. SUSCRIPCIONES PUSH
-- Se crea ahora, aunque se utilizará en una fase posterior.
-- =========================================================

CREATE TABLE public.suscripciones_push (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  usuario_id uuid NOT NULL,

  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,

  expiration_time bigint,

  user_agent text,
  nombre_dispositivo text,

  activa boolean NOT NULL DEFAULT true,
  ultimo_uso timestamptz,

  cantidad_fallos integer NOT NULL DEFAULT 0,
  ultimo_error text,

  CONSTRAINT suscripciones_push_endpoint_unico
    UNIQUE (endpoint),

  CONSTRAINT suscripciones_push_endpoint_no_vacio
    CHECK (btrim(endpoint) <> ''),

  CONSTRAINT suscripciones_push_p256dh_no_vacio
    CHECK (btrim(p256dh) <> ''),

  CONSTRAINT suscripciones_push_auth_no_vacio
    CHECK (btrim(auth) <> ''),

  CONSTRAINT suscripciones_push_fallos_validos
    CHECK (cantidad_fallos >= 0)
);

CREATE INDEX suscripciones_push_usuario_idx
  ON public.suscripciones_push (usuario_id);

CREATE INDEX suscripciones_push_activas_idx
  ON public.suscripciones_push (
    usuario_id,
    activa
  )
  WHERE activa = true;


-- =========================================================
-- 5. ACTUALIZACIÓN AUTOMÁTICA DE updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION public.actualizar_updated_at_bandeja()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER numeros_whatsapp_actualizar_updated_at
BEFORE UPDATE ON public.numeros_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_updated_at_bandeja();

CREATE TRIGGER conversaciones_whatsapp_actualizar_updated_at
BEFORE UPDATE ON public.conversaciones_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_updated_at_bandeja();

CREATE TRIGGER mensajes_whatsapp_actualizar_updated_at
BEFORE UPDATE ON public.mensajes_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_updated_at_bandeja();

CREATE TRIGGER suscripciones_push_actualizar_updated_at
BEFORE UPDATE ON public.suscripciones_push
FOR EACH ROW
EXECUTE FUNCTION public.actualizar_updated_at_bandeja();


-- =========================================================
-- 6. SINCRONIZAR RESUMEN DE CONVERSACIÓN
-- Solo se ejecuta cuando el mensaje fue insertado realmente.
-- Así un webhook duplicado no incrementa los no leídos.
-- =========================================================

CREATE OR REPLACE FUNCTION public.sincronizar_conversacion_desde_mensaje()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  previsualizacion text;
  nueva_ventana timestamptz;
BEGIN
  previsualizacion :=
    CASE
      WHEN nullif(btrim(NEW.contenido), '') IS NOT NULL
        THEN left(btrim(NEW.contenido), 500)
      WHEN NEW.tipo = 'image' THEN '[Imagen]'
      WHEN NEW.tipo = 'audio' THEN '[Audio]'
      WHEN NEW.tipo = 'document' THEN '[Documento]'
      WHEN NEW.tipo = 'video' THEN '[Video]'
      WHEN NEW.tipo = 'sticker' THEN '[Sticker]'
      WHEN NEW.tipo = 'location' THEN '[Ubicación]'
      WHEN NEW.tipo = 'contacts' THEN '[Contacto]'
      WHEN NEW.tipo = 'interactive' THEN '[Mensaje interactivo]'
      WHEN NEW.tipo = 'reaction' THEN '[Reacción]'
      WHEN NEW.tipo = 'template' THEN '[Plantilla]'
      ELSE '[Mensaje]'
    END;

  nueva_ventana :=
    CASE
      WHEN NEW.direccion = 'entrante'
        THEN NEW.fecha_mensaje + interval '24 hours'
      ELSE NULL
    END;

  UPDATE public.conversaciones_whatsapp
  SET
    ultimo_mensaje =
      CASE
        WHEN fecha_ultimo_mensaje IS NULL
          OR NEW.fecha_mensaje >= fecha_ultimo_mensaje
          THEN previsualizacion
        ELSE ultimo_mensaje
      END,

    ultimo_tipo =
      CASE
        WHEN fecha_ultimo_mensaje IS NULL
          OR NEW.fecha_mensaje >= fecha_ultimo_mensaje
          THEN NEW.tipo
        ELSE ultimo_tipo
      END,

    ultima_direccion =
      CASE
        WHEN fecha_ultimo_mensaje IS NULL
          OR NEW.fecha_mensaje >= fecha_ultimo_mensaje
          THEN NEW.direccion
        ELSE ultima_direccion
      END,

    fecha_ultimo_mensaje =
      CASE
        WHEN fecha_ultimo_mensaje IS NULL
          OR NEW.fecha_mensaje >= fecha_ultimo_mensaje
          THEN NEW.fecha_mensaje
        ELSE fecha_ultimo_mensaje
      END,

    fecha_ultimo_mensaje_entrante =
      CASE
        WHEN NEW.direccion <> 'entrante'
          THEN fecha_ultimo_mensaje_entrante
        WHEN fecha_ultimo_mensaje_entrante IS NULL
          OR NEW.fecha_mensaje > fecha_ultimo_mensaje_entrante
          THEN NEW.fecha_mensaje
        ELSE fecha_ultimo_mensaje_entrante
      END,

    fecha_ultimo_mensaje_saliente =
      CASE
        WHEN NEW.direccion <> 'saliente'
          THEN fecha_ultimo_mensaje_saliente
        WHEN fecha_ultimo_mensaje_saliente IS NULL
          OR NEW.fecha_mensaje > fecha_ultimo_mensaje_saliente
          THEN NEW.fecha_mensaje
        ELSE fecha_ultimo_mensaje_saliente
      END,

    ventana_atencion_hasta =
      CASE
        WHEN nueva_ventana IS NULL
          THEN ventana_atencion_hasta
        WHEN ventana_atencion_hasta IS NULL
          OR nueva_ventana > ventana_atencion_hasta
          THEN nueva_ventana
        ELSE ventana_atencion_hasta
      END,

    no_leidos =
      no_leidos +
      CASE
        WHEN NEW.direccion = 'entrante' THEN 1
        ELSE 0
      END,

    estado =
      CASE
        WHEN NEW.direccion = 'entrante' THEN 'abierta'
        ELSE estado
      END,

    cerrada_at =
      CASE
        WHEN NEW.direccion = 'entrante' THEN NULL
        ELSE cerrada_at
      END

  WHERE id = NEW.conversacion_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER mensajes_whatsapp_sincronizar_conversacion
AFTER INSERT ON public.mensajes_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_conversacion_desde_mensaje();


-- =========================================================
-- 7. ROW LEVEL SECURITY
-- Sin políticas públicas: acceso únicamente desde el servidor.
-- =========================================================

ALTER TABLE public.numeros_whatsapp
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.conversaciones_whatsapp
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.mensajes_whatsapp
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suscripciones_push
  ENABLE ROW LEVEL SECURITY;

COMMIT;