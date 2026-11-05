import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Image, ImageSourcePropType, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { PerfilLookup } from '../../types/business';
import { EFACT_THEME, ERUBRICA_COLORS } from '../../styles/theme';
import { styles } from '../../styles/appStyles';
import { DropdownField } from '../ui/FormShared';
import { Field, PrimaryButton, SecondaryButton } from '../ui/FormControls';
import { InitialsAvatar } from '../ui/MenuItem';

export type PerfilFormData = {
  nombres: string;
  apellidos: string;
  nombreEmpresa: string;
  email: string;
  avatarUrl: string;
  avatarUploadUri: string;
  avatarUploadName: string;
  avatarUploadMimeType: string;
  identificacion: string;
  tipoCliente: number;
  idTipoIdentificacion: number | null;
  direccionEmpresa: string;
  celular: string;
  nuevaPassword: string;
  confirmarPassword: string;
  cambiarClave: boolean;
};

export function PerfilForm<T extends PerfilFormData>({
  service = 'efact',
  form,
  lookup,
  saving,
  onChange,
  onReset,
  onSelectAvatar,
  onSelectInitialsAvatar,
  onSelectPresetAvatar,
  onSave,
  onOpenPrivacy,
  avatars,
  avatarImageSource,
  resolveImageUrl,
  getInitials,
  isInitialsAvatar,
  isPersonalPhoto,
  getTipoClienteLabel,
}: {
  service?: 'efact' | 'erubrica';
  form: T;
  lookup: PerfilLookup | null;
  saving: boolean;
  onChange: <K extends keyof T>(key: K, value: T[K]) => void;
  onReset: () => void;
  onSelectAvatar: () => void;
  onSelectInitialsAvatar: () => void;
  onSelectPresetAvatar: (avatar: string) => void;
  onSave: () => void;
  onOpenPrivacy: () => void;
  avatars: string[];
  avatarImageSource: (fileName: string) => ImageSourcePropType;
  resolveImageUrl: (value?: string | null) => string;
  getInitials: (nombres?: string | null, apellidos?: string | null, razonSocial?: string | null) => string;
  isInitialsAvatar: (value?: string | null) => boolean;
  isPersonalPhoto: (value?: string | null) => boolean;
  getTipoClienteLabel: (tipoCliente?: number | null) => string;
}) {
  const [editing, setEditing] = useState(false);
  const tiposCliente = lookup?.tiposCliente.length ? lookup.tiposCliente : [
    { tclCodigo: 1, descripcion: 'Persona Natural' },
    { tclCodigo: 2, descripcion: 'Persona Juridica' },
  ];
  const identificaciones = lookup?.tiposIdentificacion ?? [];
  const esEmpresa = form.tipoCliente === 2;
  const selectedAvatar = form.avatarUrl.toLowerCase().includes('images/avatars/') ? form.avatarUrl.split('/').pop() || 'Avatar-Boy.jpg' : '';
  const initials = getInitials(form.nombres, form.apellidos, form.nombreEmpresa);
  const usesInitials = isInitialsAvatar(form.avatarUrl);
  const usesPersonalPhoto = isPersonalPhoto(form.avatarUrl);
  const displayName = esEmpresa
    ? form.nombreEmpresa || 'Empresa'
    : [form.nombres, form.apellidos].filter(Boolean).join(' ') || 'Usuario';
  const erubrica = service === 'erubrica';
  const accentColor = erubrica ? ERUBRICA_COLORS.primary : EFACT_THEME.colors.primary;
  const profileLabel = erubrica ? 'Perfil E-RÚBRICA' : getTipoClienteLabel(form.tipoCliente) || 'Perfil E-FACT';
  const identificationLabel = identificaciones.find((item) => item.idTipoIdentificacion === form.idTipoIdentificacion)?.descripcion
    ?? identificaciones.find((item) => item.idTipoIdentificacion === form.idTipoIdentificacion)?.nombreTipo
    ?? 'Identificacion';

  if (!editing) {
    return (
      <View style={styles.profileOverview}>
        <View style={[styles.profileHeroCard, erubrica && styles.erubricaProfileHeroCard]}>
          <View style={styles.profileHeroTop}>
            {usesInitials ? (
              <InitialsAvatar initials={initials} size={88} />
            ) : (
              <Image source={{ uri: resolveImageUrl(form.avatarUrl) }} style={styles.profileHeroImage} />
            )}
            <View style={styles.profileHeroCopy}>
              <Text style={[styles.profileHeroEyebrow, erubrica && styles.erubricaProfileHeroEyebrow]}>{profileLabel}</Text>
              <Text style={styles.profileHeroName} numberOfLines={2}>{displayName}</Text>
              <Text style={styles.profileHeroMeta} numberOfLines={1}>{form.email || 'Correo no registrado'}</Text>
            </View>
          </View>
          <View style={styles.profileHeroActions}>
            <Pressable style={[styles.profileMainAction, erubrica && styles.erubricaProfileMainAction]} onPress={() => setEditing(true)}>
              <MaterialCommunityIcons name="account-edit-outline" size={19} color="#FFFFFF" />
              <Text style={styles.profileMainActionText}>Editar perfil</Text>
            </Pressable>
            <Pressable style={styles.profileSecondaryAction} onPress={onSelectAvatar}>
              <MaterialCommunityIcons name="camera-outline" size={18} color={accentColor} />
              <Text style={[styles.profileSecondaryActionText, erubrica && styles.erubricaProfileSecondaryActionText]}>Foto</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.profileInfoGrid}>
          <ProfileInfoTile icon="card-account-details-outline" label={identificationLabel} value={form.identificacion || 'Sin identificacion'} />
          <ProfileInfoTile icon="cellphone" label="Celular" value={form.celular || 'Sin celular'} />
          <ProfileInfoTile icon="map-marker-outline" label="Direccion" value={form.direccionEmpresa || 'Sin direccion'} full />
        </View>

        <Pressable style={styles.profileSecondaryAction} onPress={onOpenPrivacy}>
          <MaterialCommunityIcons name="shield-account-outline" size={19} color={accentColor} />
          <Text style={[styles.profileSecondaryActionText, erubrica && styles.erubricaProfileSecondaryActionText]}>Política de privacidad</Text>
        </Pressable>
        <View style={[styles.profileSecurityCard, erubrica && styles.erubricaProfileSecurityCard]}>
          <View style={[styles.profileSecurityIcon, erubrica && styles.erubricaProfileSecurityIcon]}>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color={accentColor} />
          </View>
          <View style={styles.profileSecurityCopy}>
            <Text style={[styles.profileSecurityTitle, erubrica && styles.erubricaProfileSecurityTitle]}>Cuenta protegida</Text>
            <Text style={[styles.profileSecurityText, erubrica && styles.erubricaProfileSecurityText]}>Tu clave y tus accesos de firma se mantienen separados de tus comprobantes.</Text>
          </View>
        </View>
        <View style={styles.infoNotice}>
          <View style={styles.infoNoticeIcon}>
            <Text style={styles.infoNoticeIconText}>i</Text>
          </View>
          <View style={styles.infoNoticeBody}>
            <Text style={styles.infoNoticeTitle}>{erubrica ? 'Datos para firma electronica' : 'Datos para facturacion'}</Text>
            <Text style={styles.infoNoticeText}>{erubrica ? 'Esta información se utilizará para validar tu identidad dentro de E-RÚBRICA.' : 'Esta informacion se utilizara para emitir correctamente tus comprobantes.'}</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.clientFormCard}>
      <View style={styles.profileEditHeader}>
        <View style={styles.profileEditTitleBlock}>
          <Text style={styles.clientFormTitle}>{erubrica ? 'Editar perfil E-RÚBRICA' : 'Editar perfil'}</Text>
          <Text style={styles.profileEditHint}>Actualiza solo los datos que necesites cambiar.</Text>
        </View>
        <Pressable style={styles.profileCloseEditButton} onPress={() => setEditing(false)}>
          <MaterialCommunityIcons name="close" size={20} color={accentColor} />
        </Pressable>
      </View>
      <View style={styles.profileAvatarPanel}>
        {usesInitials ? (
          <InitialsAvatar initials={initials} size={82} />
        ) : (
          <Image source={{ uri: resolveImageUrl(form.avatarUrl) }} style={styles.profileAvatarImage} />
        )}
        <View style={styles.profileAvatarInfo}>
          <Text style={styles.profileAvatarName} numberOfLines={2}>{displayName}</Text>
          <Text style={styles.profileAvatarMeta}>{usesPersonalPhoto ? 'Foto personal cargada' : usesInitials ? 'Iniciales del nombre' : 'Avatar seleccionado'}</Text>
          <Text style={styles.profileAvatarCount}>{avatars.length} avatares disponibles</Text>
          <Pressable style={styles.profileUploadButton} onPress={onSelectAvatar}>
            <Text style={styles.profileUploadText}>Subir foto propia</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarStrip}>
        <Pressable
          style={[styles.avatarChoice, usesInitials && styles.avatarChoiceActive]}
          onPress={onSelectInitialsAvatar}
        >
          <InitialsAvatar initials={initials} size={42} />
        </Pressable>
        {avatars.map((avatar) => (
          <Pressable
            key={`perfil-${avatar}`}
            style={[styles.avatarChoice, !usesPersonalPhoto && selectedAvatar === avatar && styles.avatarChoiceActive]}
            onPress={() => onSelectPresetAvatar(avatar)}
          >
            <Image source={avatarImageSource(avatar)} style={styles.avatarChoiceImage} />
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.infoNotice}>
        <View style={styles.infoNoticeIcon}>
          <Text style={styles.infoNoticeIconText}>i</Text>
        </View>
        <View style={styles.infoNoticeBody}>
          <Text style={styles.infoNoticeTitle}>{erubrica ? 'Datos para firma electronica' : 'Datos para facturacion'}</Text>
          <Text style={styles.infoNoticeText}>{erubrica ? 'Esta información se utilizará para validar tu identidad dentro de E-RÚBRICA.' : 'Esta informacion se utilizara para emitir correctamente tus comprobantes.'}</Text>
        </View>
      </View>
      <View style={styles.formSectionBox}>
        <Text style={styles.clientFormSubtitle}>{erubrica ? 'Cuenta E-RÚBRICA' : 'Cuenta'}</Text>
        <Field label="Correo Electronico (opcional)" value={form.email} onChangeText={(value) => onChange('email', value)} autoCapitalize="none" keyboardType="email-address" />
        <DropdownField
          label="Tipo de cliente *"
          options={tiposCliente.map((tipo) => ({ label: getTipoClienteLabel(tipo.tclCodigo), value: tipo.tclCodigo }))}
          value={form.tipoCliente || null}
          placeholder="-- Seleccione Tipo --"
          allowClear
          onChange={(value) => onChange('tipoCliente', value ?? 0)}
        />
        <DropdownField
          label="Tipo identificacion *"
          options={identificaciones.map((item) => ({ label: item.descripcion || item.nombreTipo, value: item.idTipoIdentificacion }))}
          value={form.idTipoIdentificacion}
          placeholder="-- Seleccione --"
          allowClear
          onChange={(value) => onChange('idTipoIdentificacion', value)}
        />
        <Field label="Identificacion *" value={form.identificacion} onChangeText={(value) => onChange('identificacion', value)} />
      </View>
      <View style={styles.formSectionBox}>
        <Text style={styles.clientFormSubtitle}>Datos personales</Text>
        {esEmpresa ? (
          <Field label="Razon social *" value={form.nombreEmpresa} onChangeText={(value) => onChange('nombreEmpresa', value)} />
        ) : (
          <>
            <Field label="Nombres *" value={form.nombres} onChangeText={(value) => onChange('nombres', value)} />
            <Field label="Apellidos *" value={form.apellidos} onChangeText={(value) => onChange('apellidos', value)} />
          </>
        )}
      </View>
      <View style={styles.formSectionBox}>
        <Text style={styles.clientFormSubtitle}>Contacto</Text>
        <Field label="Celular (opcional)" value={form.celular} onChangeText={(value) => onChange('celular', value)} keyboardType="phone-pad" />
        <Field label="Direccion *" value={form.direccionEmpresa} onChangeText={(value) => onChange('direccionEmpresa', value)} />
      </View>
      <View style={styles.formSectionBox}>
        <View style={styles.securityHeaderRow}>
          <View style={styles.securityTitleBlock}>
            <Text style={styles.clientFormSubtitle}>Seguridad</Text>
            <Text style={styles.clientFormTitle}>Clave de acceso</Text>
          </View>
          <View style={styles.securityToggleRow}>
            <Text style={styles.securityStablePill}>{form.cambiarClave ? 'Cambio' : 'Estable'}</Text>
            <Pressable
              style={[styles.securitySwitch, form.cambiarClave && styles.securitySwitchActive]}
              onPress={() => {
                const next = !form.cambiarClave;
                onChange('cambiarClave', next);
                if (!next) {
                  onChange('nuevaPassword', '');
                  onChange('confirmarPassword', '');
                }
              }}
            >
              <View style={[styles.securitySwitchKnob, form.cambiarClave && styles.securitySwitchKnobActive]} />
            </Pressable>
            <Text style={styles.securityToggleText}>Cambiar</Text>
          </View>
        </View>
        {form.cambiarClave ? (
          <>
            <Field label="Nueva clave *" value={form.nuevaPassword} onChangeText={(value) => onChange('nuevaPassword', value)} secureTextEntry />
            <Field label="Confirmar clave *" value={form.confirmarPassword} onChangeText={(value) => onChange('confirmarPassword', value)} secureTextEntry />
          </>
        ) : (
          <View style={styles.securityNoChangeBox}>
            <View style={styles.infoNoticeIcon}>
              <Text style={styles.infoNoticeIconText}>✓</Text>
            </View>
            <Text style={styles.securityNoChangeText}>Sin cambios en contraseña</Text>
          </View>
        )}
      </View>
      <View style={styles.formActions}>
        <SecondaryButton label="Cancelar" onPress={() => {
          onReset();
          setEditing(false);
        }} />
        <PrimaryButton label="Guardar cambios" loading={saving} onPress={onSave} />
      </View>
    </View>
  );
}
export function ProfileInfoTile({
  icon,
  label,
  value,
  full,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <View style={[styles.profileInfoTile, full && styles.profileInfoTileFull]}>
      <View style={styles.profileInfoIcon}>
        <MaterialCommunityIcons name={icon} size={19} color={EFACT_THEME.colors.primary} />
      </View>
      <View style={styles.profileInfoCopy}>
        <Text style={styles.profileInfoLabel}>{label}</Text>
        <Text style={styles.profileInfoValue} numberOfLines={full ? 2 : 1}>{value}</Text>
      </View>
    </View>
  );
}
