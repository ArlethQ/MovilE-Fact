import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Field, MessageBox, MessageState, PrimaryButton, SearchField, SecondaryButton } from '../ui/FormControls';
import { PuntoEmision, PuntosEmisionData } from '../../types/business';
import { getPuntoDocumentSequences, getPuntoSerie, normalizeSerieCode } from '../../utils/documentSeries';
import { styles } from '../../styles/appStyles';
import { FormTopBar } from '../ui/FormShared';

type PuntoFormMode = 'create' | 'edit' | null;
type PuntoFormState = { puntoEmision: string };

export function PuntosEmisionScreen({
  data,
  loading,
  message,
  search,
  form,
  formMode,
  saving,
  onSearchChange,
  onCreate,
  onCancelForm,
  onChangeForm,
  onResetForm,
  onSaveForm,
  onEdit,
  onDelete,
  onMakePrincipal,
}: {
  data: PuntosEmisionData | null;
  loading: boolean;
  message: MessageState;
  search: string;
  form: PuntoFormState;
  formMode: PuntoFormMode;
  saving: boolean;
  onSearchChange: (value: string) => void;
  onCreate: () => void;
  onCancelForm: () => void;
  onChangeForm: (key: keyof PuntoFormState, value: string) => void;
  onResetForm: () => void;
  onSaveForm: () => void;
  onEdit: (punto: PuntoEmision) => void;
  onDelete: (punto: PuntoEmision) => void;
  onMakePrincipal: (punto: PuntoEmision) => void;
}) {
  const cajas = data?.cajas ?? [];
  const principal = cajas.find((punto) => punto.esPrincipal) ?? cajas[0] ?? null;
  const seriePrincipal = principal ? getPuntoSerie(principal) : '001-000';
  const establecimiento = normalizeSerieCode(data?.emisor?.codEstablecimiento) || '001';
  const filtered = cajas.filter((punto) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [getPuntoSerie(punto), punto.puntoEmision, punto.establecimiento, punto.numCaja]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  if (formMode) {
    return (
      <>
        {message ? <MessageBox message={message} /> : null}
        <PuntoEmisionForm
          form={form}
          mode={formMode}
          saving={saving}
          establecimiento={establecimiento}
          onCancel={onCancelForm}
          onChange={onChangeForm}
          onReset={onResetForm}
          onSave={onSaveForm}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.puntoHero}>
        <View style={styles.puntoHeroTop}>
          <View style={styles.puntoHeroIcon}>
            <MaterialCommunityIcons name="office-building-cog-outline" size={30} color="#FFFFFF" />
          </View>
          <View style={styles.puntoHeroCopy}>
            <Text style={styles.puntoHeroEyebrow}>Configuracion tributaria</Text>
            <Text style={styles.puntoHeroTitle}>Establecimientos y puntos de emision</Text>
            <Text style={styles.puntoHeroText}>Administra las series electronicas que usaras al generar documentos.</Text>
          </View>
        </View>
        <View style={styles.puntoHeroFooter}>
          <View style={styles.puntoHeroBadge}>
            <Text style={styles.puntoHeroBadgeLabel}>Serie principal</Text>
            <Text style={styles.puntoHeroBadgeValue}>{seriePrincipal}</Text>
          </View>
          <Pressable style={styles.puntoHeroButton} onPress={onCreate}>
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            <Text style={styles.puntoHeroButtonText}>Agregar</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.puntoMetricGrid}>
        <PuntoMetric icon="domain" label="Emisor activo" value={data?.emisor ? '1' : '0'} />
        <PuntoMetric icon="store-cog-outline" label="Puntos" value={String(cajas.length)} />
        <PuntoMetric icon="star-circle-outline" label="Principal" value={seriePrincipal} />
      </View>

      {data?.emisor ? (
        <View style={styles.puntoSummaryGrid}>
          <View style={styles.puntoSummaryCard}>
            <Text style={styles.puntoSectionEyebrow}>Establecimiento seleccionado</Text>
            <Text style={styles.puntoSummaryTitle}>{`${establecimiento} - Matriz`}</Text>
            <Text style={styles.puntoSummaryText}>{data.emisor.dirEstablecimiento || data.emisor.direccionMatriz || 'Sin direccion configurada'}</Text>
            <View style={styles.puntoInlineMeta}>
              <MaterialCommunityIcons name="check-circle" size={15} color="#13945A" />
              <Text style={styles.puntoInlineMetaText}>Activo para emision</Text>
            </View>
          </View>

          <View style={styles.puntoPreviewCard}>
            <Text style={styles.puntoSectionEyebrow}>Vista previa</Text>
            <View style={styles.puntoPreviewBox}>
              <MaterialCommunityIcons name="file-document-check-outline" size={24} color="#0072BD" />
              <Text style={styles.puntoPreviewSerie}>{seriePrincipal}</Text>
              <Text style={styles.puntoPreviewLabel}>Documentos electronicos</Text>
            </View>
            <Text style={styles.puntoSummaryText}>Esta serie se aplicara primero en facturas, notas, retenciones, guias y liquidaciones.</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.puntoToolbar}>
        <SearchField
          label="Buscar puntos de emision"
          placeholder="Serie, caja o establecimiento"
          value={search}
          onChangeText={onSearchChange}
          resultCount={filtered.length}
          totalCount={cajas.length}
        />
      </View>

      {message ? <MessageBox message={message} /> : null}
      {loading ? (
        <View style={styles.directoryLoading}>
          <ActivityIndicator color="#0072BD" />
          <Text style={styles.mutedText}>Cargando puntos de emision...</Text>
        </View>
      ) : null}
      {!loading && cajas.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sin puntos de emision</Text>
          <Text style={styles.emptyText}>Cuando existan registros, apareceran aqui.</Text>
        </View>
      ) : null}

      <View style={styles.puntoListSection}>
        <View style={styles.puntoListHeader}>
          <View>
            <Text style={styles.puntoSectionEyebrow}>Organizacion</Text>
            <Text style={styles.puntoListTitle}>Puntos configurados</Text>
          </View>
          <View style={styles.puntoCountBadge}>
            <Text style={styles.puntoCountText}>{filtered.length}</Text>
          </View>
        </View>
        <View style={styles.listStack}>
          {filtered.map((punto, index) => (
            <PuntoEmisionCard
              key={`punto-${punto.sec}-${index}`}
              punto={punto}
              canDelete={!punto.esPrincipal && cajas.length > 1}
              onEdit={() => onEdit(punto)}
              onDelete={() => onDelete(punto)}
              onMakePrincipal={() => onMakePrincipal(punto)}
            />
          ))}
        </View>
      </View>
    </>
  );
}

function PuntoMetric({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }) {
  return (
    <View style={styles.puntoMetricCard}>
      <View style={styles.puntoMetricIcon}>
        <MaterialCommunityIcons name={icon} size={21} color="#0072BD" />
      </View>
      <Text style={styles.puntoMetricLabel}>{label}</Text>
      <Text style={styles.puntoMetricValue}>{value}</Text>
    </View>
  );
}

function PuntoEmisionForm({
  form,
  mode,
  saving,
  establecimiento,
  onCancel,
  onChange,
  onReset,
  onSave,
}: {
  form: PuntoFormState;
  mode: Exclude<PuntoFormMode, null>;
  saving: boolean;
  establecimiento: string;
  onCancel: () => void;
  onChange: (key: keyof PuntoFormState, value: string) => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const punto = normalizeSerieCode(form.puntoEmision);

  return (
    <View style={styles.puntoFormCard}>
      <FormTopBar onBack={onCancel} onDiscard={onCancel} />
      <View style={styles.puntoFormHeader}>
        <Text style={styles.puntoFormTitle}>{mode === 'edit' ? 'Editar punto' : 'Nuevo punto'}</Text>
      </View>
      <View style={styles.puntoSerieComposer}>
        <View style={styles.puntoSeriePiece}>
          <Text style={styles.puntoSeriePieceLabel}>Establecimiento</Text>
          <Text style={styles.puntoSeriePieceValue}>{establecimiento || '001'}</Text>
        </View>
        <Text style={styles.puntoSerieDash}>-</Text>
        <View style={styles.puntoSeriePiece}>
          <Text style={styles.puntoSeriePieceLabel}>Punto</Text>
          <Text style={styles.puntoSeriePieceValue}>{punto || '000'}</Text>
        </View>
      </View>
      <Field
        label="Punto de emision *"
        value={form.puntoEmision}
        onChangeText={(value) => onChange('puntoEmision', value.replace(/\D/g, '').slice(0, 3))}
        keyboardType="number-pad"
      />
      <View style={styles.formActions}>
        <SecondaryButton label="Limpiar" onPress={onReset} />
        <PrimaryButton label={mode === 'edit' ? 'Guardar' : 'Crear punto'} loading={saving} onPress={onSave} />
      </View>
    </View>
  );
}

function PuntoEmisionCard({
  punto,
  canDelete,
  onEdit,
  onDelete,
  onMakePrincipal,
}: {
  punto: PuntoEmision;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMakePrincipal: () => void;
}) {
  const serie = getPuntoSerie(punto);
  const sequences = getPuntoDocumentSequences(punto);

  return (
    <View style={[styles.puntoCard, punto.esPrincipal && styles.puntoCardPrincipal]}>
      <View style={styles.puntoCardHeader}>
        <View style={styles.puntoCardIcon}>
          <MaterialCommunityIcons name={punto.esPrincipal ? 'star-circle' : 'store-outline'} size={27} color="#FFFFFF" />
        </View>
        <View style={styles.puntoCardTitleBlock}>
          <Text style={styles.puntoCardKicker}>{`Punto ${normalizeSerieCode(punto.puntoEmision ?? punto.numCaja) || '000'}`}</Text>
          <Text style={styles.puntoCardTitle}>{punto.esPrincipal ? 'Caja principal' : `Caja ${punto.numCaja ?? punto.puntoEmision ?? ''}`}</Text>
          <Text style={styles.puntoCardSerie}>Serie {serie || 'no configurada'}</Text>
        </View>
        <View style={[styles.puntoStatusBadge, punto.estado === false && styles.puntoStatusBadgeMuted]}>
          <Text style={styles.puntoStatusText}>{punto.estado === false ? 'Inactivo' : punto.esPrincipal ? 'Principal' : 'Activo'}</Text>
        </View>
      </View>

      <View style={styles.puntoSequencePanel}>
        <View style={styles.puntoSequenceHeader}>
          <Text style={styles.puntoSequenceTitle}>Secuencias por documento</Text>
          <Text style={styles.puntoSequenceStatus}>{sequences.length} tipos</Text>
        </View>
        <View style={styles.puntoSequenceGrid}>
          {sequences.map((item) => (
            <View key={`${serie}-${item.label}`} style={styles.puntoSequenceItem}>
              <Text style={styles.puntoSequenceLabel}>{item.label}</Text>
              <Text style={styles.puntoSequenceSerie}>{item.serie}</Text>
              <Text style={styles.puntoSequenceNumber}>Sec. {item.secuencia}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.puntoCardActions}>
        <Pressable style={styles.puntoActionButton} onPress={onEdit}>
          <MaterialCommunityIcons name="pencil-outline" size={17} color="#00649D" />
          <Text style={styles.puntoActionText}>Editar</Text>
        </Pressable>
        {!punto.esPrincipal ? (
          <Pressable style={styles.puntoActionButton} onPress={onMakePrincipal}>
            <MaterialCommunityIcons name="star-outline" size={17} color="#00649D" />
            <Text style={styles.puntoActionText}>Principal</Text>
          </Pressable>
        ) : null}
        {canDelete ? (
          <Pressable style={[styles.puntoActionButton, styles.puntoActionDanger]} onPress={onDelete}>
            <MaterialCommunityIcons name="trash-can-outline" size={17} color="#B4232D" />
            <Text style={[styles.puntoActionText, styles.puntoActionDangerText]}>Eliminar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
