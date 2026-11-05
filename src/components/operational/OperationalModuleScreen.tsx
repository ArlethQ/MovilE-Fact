import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { formatDocumentDate } from '../../utils/documentFormatting';
import { getInvoiceStatusStyle, getInvoiceStatusTextStyle } from '../documents/DocumentHistoryShared';
import { ItemDetailModal, ResultCollection } from '../data/ResultCollection';
import { AccountStatementScreen as ExtractedAccountStatementScreen, AccountsReceivableScreen as ExtractedAccountsReceivableScreen, OperationalForm as ExtractedOperationalForm } from '../cuentas/OperationalFinancialScreens';
import { RechargeHistoryScreen as ExtractedRechargeHistoryScreen } from '../recargas/RechargeHistoryScreen';
import { OperationalMobileItemCard } from './OperationalWidgets';
import { EmptyState } from '../ui/FeedbackStates';
import { MessageBox, PrimaryButton, SearchField } from '../ui/FormControls';
import type { OperationalMobileItem, OperationalModule } from '../../services/operationalMobileService';
import { getOperationalModuleConfig } from '../../services/operationalMobileService';
import { styles } from '../../styles/appStyles';

export type OperationalFormMode = 'create' | 'edit' | null;
export type OperationalFormState = { codigo: string; descripcion: string; valor: string; observacion: string };
export type OperationalMessage = { type: 'success' | 'error' | 'info'; text: string } | null;

export function isOperationalMobileView(view: string) {
  return Boolean(getOperationalModuleSlug(view));
}

export function getOperationalModuleSlug(view: string): OperationalModule | undefined {
  const modules: Partial<Record<string, OperationalModule>> = {
    compras: 'compras',
    'cuentas-cobrar': 'cuentas-cobrar',
    'estado-cuenta': 'cuentas-cobrar',
    recargas: 'recargas',
    'comprar-documentos': 'recargas',
    reportes: 'reportes',
    'centro-normativo': 'centro-normativo',
  };

  return modules[view];
}

export function getOperationalDefaultTab(view: string, module: OperationalModule) {
  const defaults: Partial<Record<string, string>> = {
    'cuentas-cobrar': 'Cuentas por cobrar',
    'estado-cuenta': 'Estado de cuenta',
    'comprar-documentos': 'Comprar documentos',
    recargas: 'Historial',
  };

  return defaults[view] ?? getOperationalModuleConfig(module).tabs[0] ?? '';
}

export function getOperationalScreenConfig(view: string, module: OperationalModule) {
  const base = getOperationalModuleConfig(module);
  const overrides: Partial<Record<string, { eyebrow: string; title: string; description: string; tabs: string[]; placeholder: string }>> = {
    'cuentas-cobrar': {
      eyebrow: 'Cartera',
      title: 'Cuentas por cobrar',
      description: 'Consulta facturas pendientes y registra abonos.',
      tabs: ['Cuentas por cobrar', 'Abonos'],
      placeholder: base.placeholder,
    },
    'estado-cuenta': {
      eyebrow: 'Cartera',
      title: 'Estado de cuenta',
      description: 'Revisa saldos, abonos y movimientos por cliente.',
      tabs: ['Estado de cuenta'],
      placeholder: base.placeholder,
    },
    'comprar-documentos': {
      eyebrow: 'Documentos',
      title: 'Comprar documentos',
      description: 'Compra paquetes y consulta tu saldo de documentos.',
      tabs: ['Comprar documentos', 'Paquetes'],
      placeholder: base.placeholder,
    },
    recargas: {
      eyebrow: 'Documentos',
      title: 'Mis recargas',
      description: 'Consulta únicamente tus recargas realizadas.',
      tabs: ['Historial'],
      placeholder: base.placeholder,
    },
    compras: {
      eyebrow: 'Emision de otros Documentos',
      title: 'Liquidacion de Compra',
      description: 'Consulta documentos de compra, liquidaciones y XML publicados en e-fact.',
      tabs: ['Liquidaciones', 'Documentos', 'XML'],
      placeholder: base.placeholder,
    },
  };

  return overrides[view] ?? base;
}

export function OperationalModuleScreen({
  view,
  search,
  items,
  loading,
  saving,
  message,
  activeTab,
  formMode,
  form,
  onRefresh,
  onSearch,
  onTabChange,
  onCreate,
  onCancel,
  onChange,
  onSave,
  onView,
  onEdit,
  onDelete,
  onRegisterPayment,
  onDownloadStatementFile,
}: {
  view: string;
  search: string;
  items: OperationalMobileItem[];
  loading: boolean;
  saving: boolean;
  message?: OperationalMessage;
  activeTab?: string;
  formMode: OperationalFormMode;
  form: OperationalFormState;
  onRefresh: () => void;
  onSearch: (value: string) => void;
  onTabChange: (tab: string) => void;
  onCreate: () => void;
  onCancel: () => void;
  onChange: (field: keyof OperationalFormState, value: string) => void;
  onSave: () => void;
  onView: (item: OperationalMobileItem) => void;
  onEdit: (item: OperationalMobileItem) => void;
  onDelete: (item: OperationalMobileItem) => void;
  onRegisterPayment?: (item: OperationalMobileItem) => void;
  onDownloadStatementFile?: (item: OperationalMobileItem, format: 'pdf' | 'excel') => void;
}) {
  const module = getOperationalModuleSlug(view);
  const config = module ? getOperationalScreenConfig(view, module) : null;
  const selectedTab = module ? activeTab ?? getOperationalDefaultTab(view, module) : activeTab;
  const capabilities = getOperationalCapabilities(view, selectedTab ?? '');
  const [detailItem, setDetailItem] = useState<OperationalMobileItem | null>(null);

  if (!config) return null;

  if (formMode && view !== 'cuentas-cobrar') {
    return (
      <>
        {message ? <MessageBox message={message} /> : null}
        <ExtractedOperationalForm
          title={formMode === 'edit' ? `Editar ${selectedTab}` : `Registrar ${selectedTab}`}
          form={form}
          saving={saving}
          onCancel={onCancel}
          onChange={onChange}
          onSave={onSave}
        />
      </>
    );
  }

  if (view === 'cuentas-cobrar') {
    return (
      <ExtractedAccountsReceivableScreen
        search={search}
        items={items}
        loading={loading}
        saving={saving}
        message={message}
        activeTab={selectedTab ?? 'Cuentas por cobrar'}
        formMode={formMode}
        form={form}
        placeholder={config.placeholder}
        onRefresh={onRefresh}
        onSearch={onSearch}
        onTabChange={(tab) => {
          onCancel();
          onTabChange(tab);
        }}
        onCreate={onCreate}
        onCancel={onCancel}
        onChange={onChange}
        onSave={onSave}
        onRegisterPayment={onRegisterPayment}
      />
    );
  }

  if (view === 'estado-cuenta') {
    return (
      <ExtractedAccountStatementScreen
        search={search}
        items={items}
        loading={loading}
        message={message}
        placeholder={config.placeholder}
        onRefresh={onRefresh}
        onSearch={onSearch}
        onRegisterPayment={onRegisterPayment}
        onDownloadFile={onDownloadStatementFile}
      />
    );
  }

  if (view === 'recargas' && selectedTab === 'Historial') {
    return (
      <ExtractedRechargeHistoryScreen
        search={search}
        items={items}
        loading={loading}
        message={message}
        placeholder={config.placeholder}
        onRefresh={onRefresh}
        onSearch={onSearch}
        onView={onView}
      />
    );
  }

  if (view === 'centro-normativo') {
    return (
      <CentroNormativoMobileScreen
        search={search}
        items={items}
        loading={loading}
        message={message}
        placeholder={config.placeholder}
        onRefresh={onRefresh}
        onSearch={onSearch}
      />
    );
  }

  return (
    <>
      <View style={styles.adminHeroCard}>
        <Text style={styles.heroEyebrow}>{config.eyebrow}</Text>
        <Text style={styles.heroTitle}>{config.title}</Text>
        <Text style={styles.heroText}>{config.description}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminTabs}>
        {config.tabs.map((tab) => (
          <Pressable key={tab} style={[styles.adminTab, selectedTab === tab && styles.adminTabActive]} onPress={() => onTabChange(tab)}>
            <Text style={[styles.adminTabText, selectedTab === tab && styles.adminTabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {capabilities.canCreate ? (
        <View style={styles.actionRow}>
          <PrimaryButton label={selectedTab === 'Comprar documentos' ? 'Comprar' : 'Registrar'} loading={false} onPress={onCreate} />
        </View>
      ) : null}
      {formMode ? (
        <ExtractedOperationalForm
          title={formMode === 'edit' ? `Editar ${selectedTab}` : selectedTab === 'Comprar documentos' ? 'Comprar documentos' : `Registrar ${selectedTab}`}
          form={form}
          saving={saving}
          onCancel={onCancel}
          onChange={onChange}
          onSave={onSave}
        />
      ) : null}
      <View style={styles.formSectionBox}>
        <View style={styles.adminSearchHeader}>
          <View style={styles.adminSearchTitleBlock}>
            <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
            <Text style={styles.clientFormTitle}>{selectedTab}</Text>
          </View>
          <Pressable style={styles.adminActionPill} onPress={onRefresh}>
            <Text style={styles.adminActionText}>Refrescar</Text>
          </Pressable>
        </View>
        <SearchField label={`Buscar en ${selectedTab}`} placeholder={config.placeholder} value={search} onChangeText={onSearch} resultCount={items.length} loading={loading} />
        {message ? <MessageBox message={message} /> : null}
        {loading ? <EmptyState title="Cargando registros" text="Consultando la informacion del modulo..." /> : null}
        {!loading && !message && items.length === 0 ? <EmptyState title="Sin registros para mostrar" text="Cuando existan registros, apareceran aqui." /> : null}
        {!loading && items.length > 0 ? (
          <ResultCollection
            items={items}
            resetKey={`${view}-${selectedTab}-${search}`}
            keyExtractor={(item, index) => `${view}-${item.id || 'item'}-${index}`}
            renderItem={(item) => (
              <OperationalMobileItemCard
                item={item}
                canEdit={capabilities.canEdit}
                canDelete={capabilities.canDelete}
                onView={() => {
                  setDetailItem(item);
                }}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              />
            )}
          />
        ) : null}
      </View>
      <ItemDetailModal
        visible={Boolean(detailItem)}
        title={detailItem?.title || detailItem?.id || 'Detalle'}
        values={detailItem ? [detailItem.subtitle, detailItem.status, detailItem.meta, detailItem.detail].filter(Boolean) as string[] : []}
        onClose={() => setDetailItem(null)}
      />
    </>
  );
}

const MOBILE_DOCUMENT_PRICES = {
  tier25: 0.46,
  tier48: 17.66 / 48,
  tier120: 31.74 / 120,
  tier240: 44.16 / 240,
  tier600: 69 / 600,
  high: 0.06,
};

export function calculateMobileRechargeTotal(documents: number) {
  if (documents <= 0) return 0;

  let price = MOBILE_DOCUMENT_PRICES.tier25;
  if (documents > 25 && documents <= 48) price = MOBILE_DOCUMENT_PRICES.tier48;
  else if (documents > 48 && documents <= 120) price = MOBILE_DOCUMENT_PRICES.tier120;
  else if (documents > 120 && documents <= 240) price = MOBILE_DOCUMENT_PRICES.tier240;
  else if (documents > 240 && documents <= 600) price = MOBILE_DOCUMENT_PRICES.tier600;
  else if (documents > 600) price = MOBILE_DOCUMENT_PRICES.high;

  const total = Math.round(documents * price * 100) / 100;
  const roundedInteger = Math.round(total);
  return Math.abs(total - roundedInteger) <= 0.1 ? roundedInteger : total;
}

export function calculateMobileRechargeDocuments(amount: number) {
  if (amount <= 0) return 0;

  let price = MOBILE_DOCUMENT_PRICES.tier25;
  if (amount >= 65) price = MOBILE_DOCUMENT_PRICES.high;
  else if (amount > 17.66 && amount <= 44.16) price = MOBILE_DOCUMENT_PRICES.tier240;
  else if (amount > 11.5 && amount <= 17.66) price = MOBILE_DOCUMENT_PRICES.tier48;
  else if (amount > 44.16) price = MOBILE_DOCUMENT_PRICES.tier600;

  return Math.max(0, Math.round(amount / price));
}

function getOperationalCapabilities(view: string, tab: string) {
  const readOnlyViews: string[] = ['estado-cuenta', 'reportes', 'centro-normativo'];
  if (readOnlyViews.includes(view)) {
    return { canCreate: false, canEdit: false, canDelete: false };
  }

  if (view === 'cuentas-cobrar') {
    return { canCreate: tab === 'Abonos', canEdit: false, canDelete: false };
  }

  if (view === 'comprar-documentos' || view === 'recargas') {
    return { canCreate: tab === 'Comprar documentos', canEdit: false, canDelete: false };
  }

  return { canCreate: false, canEdit: false, canDelete: false };
}

function CentroNormativoMobileScreen({
  search,
  items,
  loading,
  message,
  placeholder,
  onRefresh,
  onSearch,
}: {
  search: string;
  items: OperationalMobileItem[];
  loading: boolean;
  message?: OperationalMessage;
  placeholder: string;
  onRefresh: () => void;
  onSearch: (value: string) => void;
}) {
  const [detailItem, setDetailItem] = useState<OperationalMobileItem | null>(null);
  const detailCategory = detailItem ? getOperationalRawText(detailItem, ['categoria', 'Categoria'], detailItem.subtitle || 'Normativa') : '';
  const detailCode = detailItem ? getOperationalRawText(detailItem, ['codigo', 'Codigo', 'numero', 'Numero'], detailItem.id) : '';
  const detailVerified = detailItem ? getOperationalRawText(detailItem, ['fechaActualizacion', 'FechaActualizacion', 'fecha', 'Fecha']) : '';
  const detailSourceRaw = detailItem ? getOperationalRawText(detailItem, ['urlOficial', 'UrlOficial', 'url', 'Url', 'fuenteUrl', 'FuenteUrl', 'urlFuente', 'UrlFuente', 'link', 'Link', 'enlace', 'Enlace', 'fuenteOficial', 'FuenteOficial', 'referenciaUrl', 'ReferenciaUrl']) : '';
  const detailSourceUrl = /^https?:\/\//i.test(detailSourceRaw) ? detailSourceRaw : 'https://www.sri.gob.ec/';
  const detailArticles = detailItem ? getNormativeArticles(detailItem) : [];

  return (
    <>
      <View style={styles.normativeHero}>
        <View style={styles.normativeHeroCopy}>
          <Text style={styles.normativeEyebrow}>BASE LEGAL DE E-FACT</Text>
          <Text style={styles.normativeTitle}>Centro normativo</Text>
          <Text style={styles.normativeText}>Encuentra en un solo lugar las disposiciones que respaldan tus comprobantes electronicos.</Text>
          <View style={styles.normativeBenefits}>
            <NormativeBenefit icon="check-decagram" label="Contenido organizado" />
            <NormativeBenefit icon="link-variant" label="Fuentes oficiales" />
            <NormativeBenefit icon="refresh" label="Consulta actualizada" />
          </View>
        </View>
        <View style={styles.normativeHeroIcon}>
          <MaterialCommunityIcons name="scale-balance" size={42} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.normativeLibrary}>
        <View style={styles.adminSearchHeader}>
          <View style={styles.adminSearchTitleBlock}>
            <Text style={styles.clientFormSubtitle}>Biblioteca normativa</Text>
            <Text style={styles.clientFormTitle}>¿Que necesitas consultar?</Text>
          </View>
          <Pressable style={styles.adminActionPill} onPress={onRefresh}>
            <Text style={styles.adminActionText}>Refrescar</Text>
          </Pressable>
        </View>
        <SearchField label="Buscar normativa" placeholder={placeholder} value={search} onChangeText={onSearch} resultCount={items.length} loading={loading} />
        {message ? <MessageBox message={message} /> : null}
        {loading ? <EmptyState title="Cargando normativas" text="Consultando la biblioteca normativa..." /> : null}
        {!loading && !message && items.length === 0 ? <EmptyState title="Sin normativas" text="Cuando existan normas publicadas, apareceran aqui." /> : null}
      </View>
      {!loading && items.length > 0 ? (
        <View style={styles.normativeCardsGrid}>
          {items.map((item, index) => {
            const category = getOperationalRawText(item, ['categoria', 'Categoria'], item.subtitle || 'Normativa');
            const code = getOperationalRawText(item, ['codigo', 'Codigo', 'numero', 'Numero'], item.id);
            const rawSourceUrl = getOperationalRawText(item, ['urlOficial', 'UrlOficial', 'url', 'Url', 'fuenteUrl', 'FuenteUrl', 'urlFuente', 'UrlFuente', 'link', 'Link', 'enlace', 'Enlace', 'fuenteOficial', 'FuenteOficial', 'referenciaUrl', 'ReferenciaUrl']);
            const sourceUrl = /^https?:\/\//i.test(rawSourceUrl) ? rawSourceUrl : 'https://www.sri.gob.ec/';
            const status = item.status || getOperationalRawText(item, ['estadoNorma', 'EstadoNorma'], 'Vigente');
            return (
              <View key={`normativa-${item.id || index}`} style={styles.normativeCard}>
                <View style={styles.normativeCardTop}>
                  <Text style={styles.normativeCategoryPill}>{category}</Text>
                  <View style={[styles.invoiceHistoryStatusPill, getInvoiceStatusStyle(status)]}>
                    <Text style={[styles.invoiceHistoryStatusText, getInvoiceStatusTextStyle(status)]}>{status}</Text>
                  </View>
                </View>
                <View style={styles.normativeCardBody}>
                  <View style={styles.normativeCardIcon}>
                    <MaterialCommunityIcons name={index % 2 === 0 ? 'file-document-outline' : 'book-open-page-variant-outline'} size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.normativeCardCopy}>
                    <Text style={styles.normativeCode}># {code || 'Sin codigo'}</Text>
                    <Text style={styles.normativeCardTitle}>{item.title}</Text>
                  </View>
                </View>
                {item.detail ? <Text style={styles.normativeCardText} numberOfLines={3}>{item.detail}</Text> : null}
                <View style={styles.normativeCardActions}>
                  <Pressable style={styles.normativeDetailButton} onPress={() => setDetailItem(item)}>
                    <MaterialCommunityIcons name="book-open-outline" size={15} color="#0072BD" />
                    <Text style={styles.normativeDetailButtonText}>Ver detalle</Text>
                  </Pressable>
                  <Pressable style={styles.normativeSourceButton} onPress={() => Linking.openURL(sourceUrl)}>
                    <Text style={styles.normativeSourceText}>Fuente oficial</Text>
                    <MaterialCommunityIcons name="open-in-new" size={14} color="#0072BD" />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      <Modal visible={Boolean(detailItem)} transparent animationType="fade" onRequestClose={() => setDetailItem(null)}>
        <View style={styles.normativeModalOverlay}>
          <View style={styles.normativeModalCard}>
            <View style={styles.normativeModalHeader}>
              <View style={styles.normativeModalTitleBlock}>
                <Text style={styles.normativeCategoryPill}>{detailCategory}</Text>
                <Text style={styles.normativeModalTitle}>{detailItem?.title || 'Detalle normativo'}</Text>
                {detailCode ? <Text style={styles.normativeCode}># {detailCode}</Text> : null}
              </View>
              <Pressable style={styles.normativeModalClose} onPress={() => setDetailItem(null)}>
                <MaterialCommunityIcons name="close" size={20} color="#31516D" />
              </Pressable>
            </View>
            <ScrollView style={styles.normativeModalScroll} contentContainerStyle={styles.normativeModalContent} showsVerticalScrollIndicator={false}>
              {detailItem?.detail ? <Text style={styles.normativeModalLead}>{detailItem.detail}</Text> : null}
              {detailArticles.map((article, index) => (
                <View key={`normative-article-${index}`} style={styles.normativeArticleRow}>
                  <View style={styles.normativeArticleBadge}>
                    <Text style={styles.normativeArticleBadgeText}>{article.label}</Text>
                  </View>
                  <Text style={styles.normativeArticleText}>{article.text}</Text>
                </View>
              ))}
              {!detailItem?.detail && detailArticles.length === 0 ? <Text style={styles.normativeModalLead}>No hay detalle adicional registrado para esta normativa.</Text> : null}
            </ScrollView>
            <View style={styles.normativeModalFooter}>
              {detailVerified ? <Text style={styles.normativeVerifiedText}>Verificada: {formatDocumentDate(detailVerified)}</Text> : <View />}
              <Pressable style={styles.normativeSourceButton} onPress={() => Linking.openURL(detailSourceUrl)}>
                <Text style={styles.normativeSourceText}>Fuente oficial</Text>
                <MaterialCommunityIcons name="open-in-new" size={14} color="#0072BD" />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function NormativeBenefit({ icon, label }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }) {
  return (
    <View style={styles.normativeBenefit}>
      <MaterialCommunityIcons name={icon} size={13} color="#0072BD" />
      <Text style={styles.normativeBenefitText}>{label}</Text>
    </View>
  );
}

function getOperationalRawText(item: OperationalMobileItem, keys: string[], fallback?: string | null) {
  const row = item.raw ?? {};
  const normalizedKeys = keys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const entry = Object.entries(row).find(([key, value]) => value !== null && value !== undefined && normalizedKeys.includes(key.toLowerCase().replace(/[^a-z0-9]/g, '')));
  return entry?.[1] !== null && entry?.[1] !== undefined ? String(entry[1]) : fallback ?? '';
}

function getNormativeArticles(item: OperationalMobileItem) {
  const row = item.raw ?? {};
  const content = getOperationalRawText(item, ['contenido', 'Contenido']);
  if (content.trim()) {
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf('.-');
        if (separator <= 0) return { label: 'Detalle', text: line };
        return { label: line.slice(0, separator + 2).trim(), text: line.slice(separator + 2).trim() };
      });
  }

  const articleSource = Object.entries(row).find(([key, value]) => value !== null && value !== undefined && ['articulos', 'detallearticulos', 'requisitos', 'caracteristicas'].includes(key.toLowerCase().replace(/[^a-z0-9]/g, '')))?.[1];
  const records = Array.isArray(articleSource) ? articleSource : [];
  const fromRecords = records
    .map((record, index) => {
      if (!record) return null;
      if (typeof record !== 'object' || Array.isArray(record)) return { label: `Art. ${index + 1}.`, text: String(record) };
      const articleItem: OperationalMobileItem = { id: '', title: '', raw: record as Record<string, unknown> };
      const label = getOperationalRawText(articleItem, ['articulo', 'Articulo', 'numero', 'Numero', 'titulo', 'Titulo', 'codigo', 'Codigo'], `Art. ${index + 1}.`);
      const text = getOperationalRawText(articleItem, ['descripcion', 'Descripcion', 'detalle', 'Detalle', 'texto', 'Texto', 'contenido', 'Contenido'], '');
      return text ? { label, text } : null;
    })
    .filter((article): article is { label: string; text: string } => Boolean(article));

  if (fromRecords.length > 0) return fromRecords;

  return Object.entries(row)
    .filter(([key, value]) => value !== null && value !== undefined && /^art(iculo)?\d+/i.test(key.replace(/[^a-z0-9]/gi, '')))
    .map(([key, value]) => ({ label: key.replace(/_/g, ' '), text: String(value) }));
}
