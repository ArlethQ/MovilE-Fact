import { Pressable, Text, View } from 'react-native';

import type { CiudadLookup, ClienteLookups, ProvinciaLookup } from '../../types/business';
import { Field, PrimaryButton, SecondaryButton, SegmentButton } from '../ui/FormControls';
import { DropdownField, FormTopBar, ToggleRow } from '../ui/FormShared';
import { styles } from '../../styles/appStyles';

export type ClienteFormMode = 'create' | 'edit' | null;

export type ClienteFormState = {
  tipoCliente: number;
  tipoidentificacion: number;
  nombres: string;
  apellidos: string;
  nombrecomercial: string;
  nombrerazonsocial: string;
  numeroidentificacion: string;
  correo: string;
  correosAdicionales: string[];
  tipoContactoTelefonico: 'CELULAR' | 'CONVENCIONAL';
  telefonoconvencional: string;
  celular: string;
  direccion: string;
  oblgconta: 'SI' | 'NO';
  diasCredito: string;
  estado: boolean;
  pais: number | null;
  provincia: number | null;
  ciudad: number | null;
  observaciones: string;
  esProveedor: boolean;
  cuentaContableProveedor: string;
  creditoTributarioProveedor: string;
  codigoProveedor: string;
  esSujetoRetencionProveedor: boolean;
  registraInformacionBancariaProveedor: boolean;
  bancoProveedor: string;
  tipoCuentaProveedor: string;
  numeroCuentaProveedor: string;
};

export function ClienteForm({
  form,
  mode,
  saving,
  lookups,
  provincias,
  ciudades,
  loadingLookups,
  onCancel,
  onChange,
  onReset,
  onSave,
}: {
  form: ClienteFormState;
  mode: Exclude<ClienteFormMode, null>;
  saving: boolean;
  lookups: ClienteLookups | null;
  provincias: ProvinciaLookup[];
  ciudades: CiudadLookup[];
  loadingLookups: boolean;
  onCancel: () => void;
  onChange: <K extends keyof ClienteFormState>(key: K, value: ClienteFormState[K]) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const isEmpresa = form.tipoCliente === 2;
  const tiposClienteBase = lookups?.tipos.length ? lookups.tipos : [
    { tclCodigo: 1, descripcion: 'Persona Natural' },
    { tclCodigo: 2, descripcion: 'Persona Jurídica' },
  ];
  const tiposCliente = tiposClienteBase.map((tipo) => ({
    ...tipo,
    descripcion: getTipoClienteLabel(tipo.tclCodigo, lookups),
  }));
  const identificaciones = lookups?.identificaciones.length ? lookups.identificaciones : [
    { ideSec: 2, ideCodigo: '05', ideDescripcion: 'Cedula' },
    { ideSec: 1, ideCodigo: '04', ideDescripcion: 'RUC' },
    { ideSec: 3, ideCodigo: '06', ideDescripcion: 'Pasaporte' },
    { ideSec: 4, ideCodigo: '08', ideDescripcion: 'Identificacion del exterior' },
  ];
  const identificacionesPorTipoCliente = identificaciones.filter((item) => {
    const label = normalizeText(`${item.ideCodigo} ${item.ideDescripcion}`);
    if (!isEmpresa) return label.includes('ruc') || label.includes('cedula') || label.includes('pasaporte') || label.includes('exterior');
    return label.includes('ruc') || label.includes('pasaporte') || label.includes('exterior');
  });
  const paises = lookups?.paises ?? [];
  const diasCreditoRapidos = ['0', '15', '30', '45'];
  const diasCreditoPersonalizado = form.diasCredito.trim() !== '' && !diasCreditoRapidos.includes(form.diasCredito.trim());

  return (
    <View style={styles.clientFormCard}>
      <FormTopBar onBack={onCancel} onDiscard={onReset} />
      <Text style={styles.clientFormTitle}>{mode === 'edit' ? 'Editar cliente / proveedor' : 'Nuevo cliente / proveedor'}</Text>
      {loadingLookups ? <Text style={styles.mutedText}>Cargando catalogos...</Text> : null}

      <View style={styles.formSectionBox}>
        <Text style={styles.clientFormSubtitle}>Informacion basica</Text>
        <View style={styles.compactFieldRow}>
          <View style={styles.compactFieldGrow}>
            <DropdownField
              label="Tipo de cliente *"
              options={tiposCliente.map((tipo) => ({ label: tipo.descripcion, value: tipo.tclCodigo }))}
              value={form.tipoCliente || null}
              placeholder="-- Seleccione Tipo --"
              allowClear
              onChange={(value) => {
                onChange('tipoCliente', value ?? 0);
                if (value === 2) {
                  const currentIdentification = identificaciones.find((item) => item.ideSec === form.tipoidentificacion);
                  const currentLabel = normalizeText(`${currentIdentification?.ideCodigo ?? ''} ${currentIdentification?.ideDescripcion ?? ''}`);
                  if (currentLabel.includes('cedula')) onChange('tipoidentificacion', 0);
                }
              }}
            />
          </View>
          <View style={styles.compactFieldGrow}>
            <DropdownField
              label="Tipo identificacion *"
              options={identificacionesPorTipoCliente.map((item) => ({ label: item.ideDescripcion, value: item.ideSec }))}
              value={form.tipoidentificacion}
              onChange={(value) => {
                if (value !== null) onChange('tipoidentificacion', value);
              }}
            />
          </View>
        </View>
        <Field
          label="Numero identificacion *"
          value={form.numeroidentificacion}
          onChangeText={(value) => onChange('numeroidentificacion', value)}
          keyboardType={form.tipoidentificacion === 3 ? 'default' : 'number-pad'}
        />
        {isEmpresa ? (
          <View style={styles.compactFieldRow}>
            <View style={styles.compactFieldGrow}>
              <Field label="Nombre comercial *" value={form.nombrecomercial} onChangeText={(value) => onChange('nombrecomercial', value)} />
            </View>
            <View style={styles.compactFieldGrow}>
              <Field label="Razon social *" value={form.nombrerazonsocial} onChangeText={(value) => onChange('nombrerazonsocial', value)} />
            </View>
          </View>
        ) : (
          <View style={styles.compactFieldRow}>
            <View style={styles.compactFieldGrow}>
              <Field label="Apellidos *" value={form.apellidos} onChangeText={(value) => onChange('apellidos', value)} />
            </View>
            <View style={styles.compactFieldGrow}>
              <Field label="Nombres *" value={form.nombres} onChangeText={(value) => onChange('nombres', value)} />
            </View>
          </View>
        )}
        <ToggleRow
          label="Es proveedor"
          text="Tambien se registra para compras, retenciones y liquidaciones."
          value={form.esProveedor}
          onChange={(value) => onChange('esProveedor', value)}
        />
      </View>

      <View style={styles.formSectionBox}>
        <Text style={styles.clientFormSubtitle}>Contacto</Text>
        <Field label="Correo principal *" value={form.correo} onChangeText={(value) => onChange('correo', value)} autoCapitalize="none" keyboardType="email-address" />
        {form.correosAdicionales.map((correo, index) => (
          <View key={`correo-${index}`} style={styles.inlineFieldRow}>
            <View style={styles.inlineFieldGrow}>
              <Field
                 label={`Correo adicional ${index + 1} (opcional)`}
                value={correo}
                onChangeText={(value) => {
                  const next = [...form.correosAdicionales];
                  next[index] = value;
                  onChange('correosAdicionales', next);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>
            <Pressable
              style={styles.smallDangerButtonSolid}
              onPress={() => onChange('correosAdicionales', form.correosAdicionales.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Text style={styles.smallDangerSolidText}>Quitar</Text>
            </Pressable>
          </View>
        ))}
        <SecondaryButton label="Agregar correo adicional" onPress={() => onChange('correosAdicionales', [...form.correosAdicionales, ''])} />
        <ToggleRow
          label="Obligado a llevar contabilidad *"
          text={form.oblgconta === 'SI' ? 'SI' : 'NO'}
          value={form.oblgconta === 'SI'}
          onChange={(value) => onChange('oblgconta', value ? 'SI' : 'NO')}
        />
        <View style={styles.segment}>
          <SegmentButton active={form.tipoContactoTelefonico === 'CELULAR'} label="Celular" onPress={() => onChange('tipoContactoTelefonico', 'CELULAR')} />
          <SegmentButton active={form.tipoContactoTelefonico === 'CONVENCIONAL'} label="Convencional" onPress={() => onChange('tipoContactoTelefonico', 'CONVENCIONAL')} />
        </View>
        {form.tipoContactoTelefonico === 'CONVENCIONAL' ? (
           <Field label="Telefono convencional (opcional)" value={form.telefonoconvencional} onChangeText={(value) => onChange('telefonoconvencional', value)} keyboardType="phone-pad" />
        ) : (
           <Field label="Celular (opcional)" value={form.celular} onChangeText={(value) => onChange('celular', value)} keyboardType="phone-pad" />
        )}
      </View>

      <View style={styles.formSectionBox}>
        <Text style={styles.clientFormSubtitle}>Direccion</Text>
         <Field label="Direccion *" value={form.direccion} onChangeText={(value) => onChange('direccion', value)} />
        <View style={styles.compactFieldRow}>
          {paises.length ? (
            <View style={styles.compactFieldGrow}>
               <DropdownField label="Pais (opcional)" options={paises.map((pais) => ({ label: pais.descripcion, value: pais.idPais }))} value={form.pais} onChange={(value) => onChange('pais', value)} />
            </View>
          ) : null}
          {provincias.length ? (
            <View style={styles.compactFieldGrow}>
               <DropdownField label="Provincia (opcional)" options={provincias.map((provincia) => ({ label: provincia.descripcion, value: provincia.idProvincia }))} value={form.provincia} onChange={(value) => onChange('provincia', value)} />
            </View>
          ) : null}
          {ciudades.length ? (
            <View style={styles.compactFieldGrow}>
               <DropdownField label="Canton (opcional)" options={ciudades.map((ciudad) => ({ label: ciudad.descripcion, value: ciudad.idCiudad }))} value={form.ciudad} onChange={(value) => onChange('ciudad', value)} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.formSectionBox}>
        <Text style={styles.clientFormSubtitle}>Informacion adicional</Text>
        <View style={styles.segment}>
          {diasCreditoRapidos.map((dias) => <SegmentButton key={dias} active={form.diasCredito === dias} label={`${dias} dias`} onPress={() => onChange('diasCredito', dias)} />)}
          <SegmentButton active={diasCreditoPersonalizado} label="Otro" onPress={() => onChange('diasCredito', diasCreditoPersonalizado ? '0' : '')} />
        </View>
         {diasCreditoPersonalizado || form.diasCredito.trim() === '' ? <Field label="Dias de credito (opcional)" value={form.diasCredito} onChangeText={(value) => onChange('diasCredito', value.replace(/[^\d]/g, ''))} keyboardType="number-pad" /> : null}
         <Field label="Observaciones (opcional)" value={form.observaciones} onChangeText={(value) => onChange('observaciones', value)} />
      </View>

      <View style={styles.formActions}>
        <SecondaryButton label="Limpiar formulario" onPress={onReset} />
        <PrimaryButton label={mode === 'edit' ? 'Guardar' : 'Registrar'} loading={saving} onPress={onSave} />
      </View>
    </View>
  );
}

function getTipoClienteLabel(tipoCliente?: number | null, lookups?: ClienteLookups | null) {
  if (tipoCliente === 1) return 'Persona Natural';
  if (tipoCliente === 2) return 'Persona Juridica';
  return lookups?.tipos.find((tipo) => tipo.tclCodigo === tipoCliente)?.descripcion?.trim() || 'Sin tipo';
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}
