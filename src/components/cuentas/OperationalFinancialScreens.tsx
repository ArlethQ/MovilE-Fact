import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { OperationalMobileItem } from '../../services/operationalMobileService';
import type { MessageState } from '../ui/FormControls';
import { Field, MessageBox, PrimaryButton, SearchField, SecondaryButton } from '../ui/FormControls';
import { EmptyState } from '../ui/FeedbackStates';
import { ResultCollection } from '../data/ResultCollection';
import { formatMoney } from '../../utils/documentFormatting';
import { styles } from '../../styles/appStyles';

export type OperationalFormMode = 'create' | 'edit' | null;

export type OperationalFormState = {
  codigo: string;
  descripcion: string;
  valor: string;
  observacion: string;
};

function normalizeText(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

export function OperationalForm({
  title,
  form,
  saving,
  onCancel,
  onChange,
  onSave,
}: {
  title: string;
  form: OperationalFormState;
  saving: boolean;
  onCancel: () => void;
  onChange: (field: keyof OperationalFormState, value: string) => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.formSectionBox}>
      <Text style={styles.clientFormSubtitle}>Operacion</Text>
      <Text style={styles.clientFormTitle}>{title}</Text>
      <Field label="Codigo (opcional)" value={form.codigo} onChangeText={(value) => onChange('codigo', value)} autoCapitalize="characters" />
      <Field label="Descripcion *" value={form.descripcion} onChangeText={(value) => onChange('descripcion', value)} />
      <Field label="Valor / cantidad (opcional)" value={form.valor} onChangeText={(value) => onChange('valor', value)} keyboardType="decimal-pad" />
      <Field label="Observacion (opcional)" value={form.observacion} onChangeText={(value) => onChange('observacion', value)} />
      <View style={styles.formActions}>
        <PrimaryButton label="Guardar" loading={saving} onPress={onSave} />
        <SecondaryButton label="Cancelar" onPress={onCancel} />
      </View>
    </View>
  );
}

export function AccountsReceivableScreen({
  search,
  items,
  loading,
  saving,
  message,
  activeTab,
  formMode,
  form,
  placeholder,
  onRefresh,
  onSearch,
  onTabChange,
  onCreate,
  onCancel,
  onChange,
  onSave,
  onRegisterPayment,
}: {
  search: string;
  items: OperationalMobileItem[];
  loading: boolean;
  saving: boolean;
  message?: MessageState;
  activeTab: string;
  formMode: OperationalFormMode;
  form: OperationalFormState;
  placeholder: string;
  onRefresh: () => void;
  onSearch: (value: string) => void;
  onTabChange: (tab: string) => void;
  onCreate: () => void;
  onCancel: () => void;
  onChange: (field: keyof OperationalFormState, value: string) => void;
  onSave: () => void;
  onRegisterPayment?: (item: OperationalMobileItem) => void;
}) {
  const totalBalance = items.reduce((total, item) => total + getAccountStatementAmount(item, ['saldoPendiente', 'SaldoPendiente', 'saldoActual', 'SaldoActual', 'saldo', 'Saldo'], item.meta), 0);
  const overdueItems = items.filter((item) => normalizeText(item.status || '').includes('venc'));
  const activeClients = new Set(items.map((item) => getAccountStatementClientId(item) || item.title).filter(Boolean)).size;
  const averageDays = Math.round(items.reduce((total, item) => total + getAccountStatementNumber(item, ['diasCobro', 'DiasCobro', 'diasPromedio', 'DiasPromedio', 'diasMora', 'DiasMora'], 0), 0) / Math.max(items.length, 1));
  const selectedTab = activeTab || 'Cuentas por cobrar';
  const activeStepIndex = formMode ? 1 : 0;

  return (
    <>
      <View style={styles.receivableHeroCard}>
        <Text style={styles.heroEyebrow}>Cuentas por cobrar</Text>
        <Text style={styles.receivableHeroTitle}>Registro de abonos</Text>
        <Text style={styles.receivableHeroText}>Avance paso a paso: seleccione el cliente, registre el pago, distribuya el valor y confirme el abono.</Text>
      </View>

      <View style={styles.receivableMetricGrid}>
        <ReceivableMetricCard icon="wallet-outline" label="Saldo total por cobrar" value={formatMoney(totalBalance)} tone="blue" helper={`${items.length} factura(s) pendientes`} />
        <ReceivableMetricCard icon="calendar-alert" label="Facturas vencidas" value={formatMoney(overdueItems.reduce((total, item) => total + getAccountStatementAmount(item, ['saldoPendiente', 'SaldoPendiente', 'saldo', 'Saldo'], item.meta), 0))} tone="red" helper={`${overdueItems.length} requieren atencion`} />
        <ReceivableMetricCard icon="timer-sand" label="Facturas por vencer" value={formatMoney(Math.max(totalBalance - overdueItems.reduce((total, item) => total + getAccountStatementAmount(item, ['saldoPendiente', 'SaldoPendiente', 'saldo', 'Saldo'], item.meta), 0), 0))} tone="orange" helper="Dentro de 30 dias" />
        <ReceivableMetricCard icon="account-cash-outline" label="Clientes con saldo" value={activeClients || items.length} tone="green" helper="Cartera activa visible" />
        <ReceivableMetricCard icon="chart-line" label="Dias promedio de cobro" value={`${averageDays || 0} dias`} tone="purple" helper="Promedio general" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminTabs}>
        {['Cuentas por cobrar', 'Abonos'].map((tab) => (
          <Pressable key={tab} style={[styles.adminTab, selectedTab === tab && styles.adminTabActive]} onPress={() => onTabChange(tab)}>
            <Text style={[styles.adminTabText, selectedTab === tab && styles.adminTabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {formMode ? (
        <View style={styles.receivableFormFlow}>
          <View style={styles.receivableFormColumn}>
            <OperationalForm
              title={formMode === 'edit' ? `Editar ${selectedTab}` : `Registrar ${selectedTab}`}
              form={form}
              saving={saving}
              onCancel={onCancel}
              onChange={onChange}
              onSave={onSave}
            />
          </View>
          <AccountsReceivableSteps activeIndex={activeStepIndex} compact />
        </View>
      ) : null}

      <View style={styles.receivableSearchPanel}>
        <View style={styles.adminSearchHeader}>
          <View style={styles.adminSearchTitleBlock}>
            <Text style={styles.clientFormSubtitle}>Busqueda y filtros</Text>
            <Text style={styles.clientFormTitle}>Encuentra tu cartera rapido</Text>
          </View>
          <Pressable style={styles.adminActionPill} onPress={onRefresh}>
            <Text style={styles.adminActionText}>Refrescar</Text>
          </Pressable>
        </View>
        <SearchField label="Buscar por cedula, RUC, nombre o factura" placeholder={placeholder} value={search} onChangeText={onSearch} resultCount={items.length} loading={loading} />
        <View style={styles.receivableFilterChips}>
          {['Todas', 'Vencidas', 'Por vencer', 'Vigentes'].map((filter) => (
            <View key={filter} style={[styles.clientFilterChip, filter === 'Todas' && styles.clientFilterChipActive]}>
              <Text style={[styles.clientFilterChipText, filter === 'Todas' && styles.clientFilterChipTextActive]}>{filter}</Text>
            </View>
          ))}
        </View>
        {message ? <MessageBox message={message} /> : null}
      </View>

      <View style={styles.receivableListPanel}>
        <View style={styles.clientListHeader}>
          <View>
            <Text style={styles.clientListEyebrow}>Cartera pendiente</Text>
            <Text style={styles.clientListTitle}>{selectedTab === 'Abonos' ? 'Registro de abonos' : 'Facturas por cobrar'}</Text>
          </View>
          <Text style={styles.clientListCount}>{items.length}</Text>
        </View>
        {loading ? <EmptyState title="Cargando cartera" text="Consultando facturas pendientes..." /> : null}
        {!loading && !message && items.length === 0 ? <EmptyState title="Sin cartera para mostrar" text="Cuando existan facturas pendientes, apareceran aqui." /> : null}
        {!loading && items.length > 0 ? (
          <ResultCollection
            items={items}
            resetKey={`cuentas-cobrar-${selectedTab}-${search}`}
            keyExtractor={(item, index) => `cuenta-cobrar-${item.id || 'item'}-${index}`}
            variant="plain"
            renderItem={(item) => (
              <ReceivableInvoiceCard
                item={item}
                onRegister={() => onRegisterPayment?.(item) ?? onCreate()}
              />
            )}
          />
        ) : null}
      </View>

      {!formMode ? <AccountsReceivableSteps activeIndex={activeStepIndex} /> : null}
    </>
  );
}

function AccountsReceivableSteps({ activeIndex, compact }: { activeIndex: number; compact?: boolean }) {
  return (
    <View style={[styles.receivableSteps, compact && styles.receivableStepsCompact]}>
      {[
        ['1', 'Identificar cliente', 'Buscar por cedula, RUC o nombre'],
        ['2', 'Registrar pago', 'Monto recibido y observacion'],
        ['3', 'Distribuir', 'Aplicar el abono por factura'],
        ['4', 'Confirmar', 'Registrar el abono final'],
      ].map(([number, title, text], index) => (
        <View key={number} style={[styles.receivableStep, compact && styles.receivableStepCompact, index === activeIndex && styles.receivableStepActive]}>
          <Text style={[styles.receivableStepNumber, index === activeIndex && styles.receivableStepNumberActive]}>{number}</Text>
          <View style={styles.receivableStepCopy}>
            <Text style={styles.receivableStepTitle}>{title}</Text>
            <Text style={styles.receivableStepText}>{text}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ReceivableMetricCard({ icon, label, value, tone, helper }: { icon: ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string | number; tone: 'blue' | 'red' | 'orange' | 'green' | 'purple'; helper: string }) {
  const toneStyle = tone === 'red' ? styles.receivableMetricRed : tone === 'orange' ? styles.receivableMetricOrange : tone === 'green' ? styles.receivableMetricGreen : tone === 'purple' ? styles.receivableMetricPurple : styles.receivableMetricBlue;
  const iconColor = tone === 'red' ? '#D92D3A' : tone === 'orange' ? '#D77416' : tone === 'green' ? '#0C8C57' : tone === 'purple' ? '#7448D8' : '#0870BE';

  return (
    <View style={[styles.receivableMetricCard, toneStyle]}>
      <View style={styles.receivableMetricHeader}>
        <Text style={styles.receivableMetricLabel}>{label}</Text>
        <MaterialCommunityIcons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={styles.receivableMetricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.receivableMetricHelper}>{helper}</Text>
    </View>
  );
}

function ReceivableInvoiceCard({ item, onRegister }: { item: OperationalMobileItem; onRegister: () => void }) {
  const invoiceNumber = getAccountStatementText(item, ['numeroFactura', 'NumeroFactura', 'numeroDocumento', 'NumeroDocumento', 'factura', 'Factura']) || item.id || 'Factura';
  const client = getAccountStatementText(item, ['cliente', 'Cliente', 'nombreCliente', 'NombreCliente']) || item.title || 'Cliente';
  const identification = getAccountStatementText(item, ['numeroIdentificacion', 'NumeroIdentificacion', 'identificacion', 'Identificacion', 'ruc', 'Ruc']) || item.subtitle || 'Sin identificacion';
  const issueDate = getAccountStatementText(item, ['fechaEmision', 'FechaEmision', 'fecha', 'Fecha']) || '-';
  const dueDate = getAccountStatementText(item, ['fechaVencimiento', 'FechaVencimiento', 'vencimiento', 'Vencimiento']) || '-';
  const total = getAccountStatementDisplayMoney(item, ['total', 'Total', 'valorFacturado', 'ValorFacturado'], item.meta);
  const balance = getAccountStatementDisplayMoney(item, ['saldoPendiente', 'SaldoPendiente', 'saldoActual', 'SaldoActual', 'saldo', 'Saldo'], item.meta);
  const status = item.status || (normalizeText(dueDate).includes('-') ? 'Vigente' : 'Pendiente');
  const isOverdue = normalizeText(status).includes('venc');

  return (
    <View style={styles.receivableInvoiceCard}>
      <View style={styles.receivableInvoiceTop}>
        <View style={styles.receivableInvoiceIcon}>
          <MaterialCommunityIcons name="file-document-outline" size={20} color="#0870BE" />
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.receivableInvoiceNumber}>{invoiceNumber}</Text>
          <Text style={styles.clientName}>{client}</Text>
          <Text style={styles.clientMeta}>{identification}</Text>
        </View>
        <View style={[styles.accountStatusPill, isOverdue ? styles.accountStatusDanger : styles.receivableStatusOk]}>
          <Text style={[styles.accountStatusText, isOverdue ? styles.accountStatusTextDanger : styles.receivableStatusOkText]}>{status}</Text>
        </View>
      </View>
      <View style={styles.accountClientGrid}>
        <AccountClientStat label="Emision" value={issueDate} />
        <AccountClientStat label="Vencimiento" value={dueDate} />
        <AccountClientStat label="Total" value={total} />
        <AccountClientStat label="Saldo" value={balance} danger={isOverdue} />
      </View>
      <View style={styles.clientActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Registrar abono de ${invoiceNumber}`} style={[styles.smallActionButton, styles.smallSuccessButton]} onPress={onRegister}>
          <MaterialCommunityIcons name="cash-plus" size={16} color="#128A46" />
          <Text style={[styles.smallActionText, styles.smallSuccessText]}>Registrar</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function AccountStatementScreen({
  search,
  items,
  loading,
  message,
  placeholder,
  onRefresh,
  onSearch,
  onRegisterPayment,
  onDownloadFile,
  onViewFile,
}: {
  search: string;
  items: OperationalMobileItem[];
  loading: boolean;
  message?: MessageState;
  placeholder: string;
  onRefresh: () => void;
  onSearch: (value: string) => void;
  onRegisterPayment?: (item: OperationalMobileItem) => void;
  onDownloadFile?: (item: OperationalMobileItem, format: 'pdf' | 'excel') => void;
  onViewFile?: (item: OperationalMobileItem) => void;
}) {
  const [detailItem, setDetailItem] = useState<OperationalMobileItem | null>(null);
  const visibleBalance = items.reduce((total, item) => total + getAccountStatementAmount(item, ['saldoTotalCliente', 'SaldoTotalCliente', 'saldoActual', 'SaldoActual', 'saldoPendiente', 'SaldoPendiente', 'saldo', 'Saldo'], item.meta), 0);
  const visibleInvoices = items.reduce((total, item) => total + getAccountStatementNumber(item, ['facturas', 'Facturas', 'facturasPendientes', 'FacturasPendientes', 'cantidadFacturas', 'CantidadFacturas'], 0), 0);
  const visiblePayments = items.reduce((total, item) => total + getAccountStatementNumber(item, ['abonos', 'Abonos', 'cantidadAbonos', 'CantidadAbonos'], 0), 0);

  return (
    <>
      <View style={styles.accountHeroCard}>
        <View style={styles.accountHeroCopy}>
          <Text style={styles.heroEyebrow}>Cuentas por cobrar</Text>
          <Text style={styles.accountHeroTitle}>Estado de cuenta por cliente</Text>
          <Text style={styles.accountHeroText}>Facturas, abonos y saldos por cliente.</Text>
        </View>
        <View style={styles.accountMetricGrid}>
          <AccountMetricCard icon="wallet-outline" label="Saldo visible" value={formatMoney(visibleBalance)} tone="blue" />
          <AccountMetricCard icon="account-group-outline" label="Clientes visibles" value={items.length} tone="green" />
          <AccountMetricCard icon="file-document-outline" label="Facturas visibles" value={visibleInvoices || items.length} tone="purple" />
          <AccountMetricCard icon="cash-check" label="Abonos visibles" value={visiblePayments} tone="orange" />
        </View>
      </View>

      <View style={styles.formSectionBox}>
        <View style={styles.adminSearchHeader}>
          <View style={styles.adminSearchTitleBlock}>
            <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
            <Text style={styles.clientFormTitle}>Filtros de estado</Text>
          </View>
          <Pressable style={styles.adminActionPill} onPress={onRefresh}>
            <Text style={styles.adminActionText}>Refrescar</Text>
          </Pressable>
        </View>
        <SearchField label="Buscar por cliente, RUC o factura" placeholder={placeholder} value={search} onChangeText={onSearch} resultCount={items.length} loading={loading} />
        {message ? <MessageBox message={message} /> : null}
      </View>

      <View style={styles.accountListPanel}>
        <View style={styles.clientListHeader}>
          <View>
            <Text style={styles.clientListEyebrow}>Listado por cliente</Text>
            <Text style={styles.clientListTitle}>Estado de cuenta</Text>
          </View>
          <Text style={styles.clientListCount}>{items.length}</Text>
        </View>
        {loading ? <EmptyState title="Cargando estados" text="Consultando saldos y movimientos..." /> : null}
        {!loading && !message && items.length === 0 ? <EmptyState title="Sin clientes para mostrar" text="Cuando existan saldos, apareceran aqui." /> : null}
        {!loading && items.length > 0 ? (
          <ResultCollection
            items={items}
            resetKey={`estado-cuenta-${search}`}
            keyExtractor={(item, index) => `estado-cuenta-${item.id || 'cliente'}-${index}`}
            variant="plain"
            renderItem={(item) => (
              <AccountStatementClientCard
                item={item}
                onView={() => setDetailItem(item)}
                onRegister={() => onRegisterPayment?.(item)}
              />
            )}
          />
        ) : null}
      </View>

      <AccountStatementDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onRegister={() => {
          if (detailItem) onRegisterPayment?.(detailItem);
          setDetailItem(null);
        }}
        onDownloadFile={(format) => {
          if (detailItem) onDownloadFile?.(detailItem, format);
        }}
        onViewFile={() => {
          if (detailItem) onViewFile?.(detailItem);
        }}
      />
    </>
  );
}

function AccountMetricCard({ icon, label, value, tone }: { icon: ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string | number; tone: 'blue' | 'green' | 'purple' | 'orange' }) {
  const toneStyle = tone === 'green' ? styles.accountMetricGreen : tone === 'purple' ? styles.accountMetricPurple : tone === 'orange' ? styles.accountMetricOrange : styles.accountMetricBlue;

  return (
    <View style={styles.accountMetricCard}>
      <View style={[styles.accountMetricIcon, toneStyle]}>
        <MaterialCommunityIcons name={icon} size={17} color={tone === 'green' ? '#0C8C57' : tone === 'purple' ? '#7448D8' : tone === 'orange' ? '#D77416' : '#0870BE'} />
      </View>
      <Text style={styles.accountMetricLabel}>{label}</Text>
      <Text style={styles.accountMetricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function AccountStatementClientCard({ item, onView, onRegister }: { item: OperationalMobileItem; onView: () => void; onRegister: () => void }) {
  const balance = getAccountStatementDisplayMoney(item, ['saldoTotalCliente', 'SaldoTotalCliente', 'saldoActual', 'SaldoActual', 'saldoPendiente', 'SaldoPendiente', 'saldo', 'Saldo'], item.meta);
  const totalBilled = getAccountStatementDisplayMoney(item, ['totalFacturado', 'TotalFacturado', 'valorFacturado', 'ValorFacturado', 'total', 'Total'], undefined);
  const totalPayments = getAccountStatementDisplayMoney(item, ['totalAbonos', 'TotalAbonos', 'abonos', 'Abonos'], undefined);
  const invoiceCount = getAccountStatementNumber(item, ['facturas', 'Facturas', 'facturasPendientes', 'FacturasPendientes', 'cantidadFacturas', 'CantidadFacturas'], 1);
  const identification = getAccountStatementText(item, ['numeroIdentificacion', 'NumeroIdentificacion', 'identificacion', 'Identificacion', 'ruc', 'Ruc', 'cedula', 'Cedula']) || item.subtitle || 'Sin identificacion';
  const status = item.status || (getAccountStatementAmount(item, ['saldoTotalCliente', 'SaldoTotalCliente', 'saldoActual', 'SaldoActual', 'saldoPendiente', 'SaldoPendiente', 'saldo', 'Saldo'], item.meta) > 0 ? 'Pendiente' : 'Al dia');
  const isOverdue = normalizeText(status).includes('venc');

  return (
    <View style={styles.accountClientCard}>
      <View style={styles.clientCardHeader}>
        <View style={styles.accountClientAvatar}>
          <MaterialCommunityIcons name="account-cash-outline" size={22} color="#0870BE" />
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{item.title || 'Cliente'}</Text>
          <Text style={styles.clientMeta}>{identification}</Text>
        </View>
        <View style={[styles.accountStatusPill, isOverdue ? styles.accountStatusDanger : styles.accountStatusPending]}>
          <Text style={[styles.accountStatusText, isOverdue ? styles.accountStatusTextDanger : styles.accountStatusTextPending]}>{status}</Text>
        </View>
      </View>
      <View style={styles.accountClientGrid}>
        <AccountClientStat label="Facturas" value={invoiceCount} />
        <AccountClientStat label="Facturado" value={totalBilled} />
        <AccountClientStat label="Abonos" value={totalPayments} />
        <AccountClientStat label="Saldo" value={balance} danger />
      </View>
      <View style={styles.clientActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${item.title || item.id}`} style={[styles.smallActionButton, styles.crudViewAction]} onPress={onView}>
          <MaterialCommunityIcons name="eye-outline" size={16} color="#00649D" />
          <Text style={styles.smallActionText}>Ver</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Registrar abono de ${item.title || item.id}`} style={[styles.smallActionButton, styles.smallSuccessButton]} onPress={onRegister}>
          <MaterialCommunityIcons name="cash-plus" size={16} color="#128A46" />
          <Text style={[styles.smallActionText, styles.smallSuccessText]}>Registrar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AccountClientStat({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <View style={styles.accountClientStat}>
      <Text style={styles.accountClientStatLabel}>{label}</Text>
      <Text style={[styles.accountClientStatValue, danger && styles.accountClientStatDanger]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function AccountStatementDetailModal({ item, onClose, onRegister, onDownloadFile, onViewFile }: { item: OperationalMobileItem | null; onClose: () => void; onRegister: () => void; onDownloadFile: (format: 'pdf' | 'excel') => void; onViewFile: () => void }) {
  const [activeTab, setActiveTab] = useState<AccountStatementTab>('Historial');
  useEffect(() => {
    if (item) setActiveTab('Historial');
  }, [item]);
  const movements = item ? getAccountStatementMovements(item) : [];
  const invoices = item ? getAccountStatementInvoices(item) : [];
  const payments = item ? getAccountStatementPayments(item) : [];
  const balance = item ? getAccountStatementDisplayMoney(item, ['saldoTotalCliente', 'SaldoTotalCliente', 'saldoActual', 'SaldoActual', 'saldoPendiente', 'SaldoPendiente', 'saldo', 'Saldo'], item.meta) : '$ 0,00';
  const invoiceCount = item ? getAccountStatementNumber(item, ['facturas', 'Facturas', 'facturasPendientes', 'FacturasPendientes', 'cantidadFacturas', 'CantidadFacturas'], movements.length || 1) : 0;
  const lastPayment = item ? getAccountStatementDisplayMoney(item, ['ultimoAbono', 'UltimoAbono', 'ultimoPago', 'UltimoPago', 'valorUltimoAbono', 'ValorUltimoAbono'], '$ 0,00') : '$ 0,00';
  const daysOverdue = item ? getAccountStatementText(item, ['diasVencidos', 'DiasVencidos', 'diasMora', 'DiasMora']) || '0 dias' : '0 dias';
  const email = item ? getAccountStatementText(item, ['email', 'Email', 'correo', 'Correo']) : '';
  const identification = item ? getAccountStatementText(item, ['numeroIdentificacion', 'NumeroIdentificacion', 'identificacion', 'Identificacion', 'ruc', 'Ruc']) || item.subtitle : '';
  const totalBilled = item ? getAccountStatementDisplayMoney(item, ['totalFacturado', 'TotalFacturado', 'valorFacturado', 'ValorFacturado', 'total', 'Total'], balance) : '$ 0,00';
  const totalPaid = item ? getAccountStatementDisplayMoney(item, ['totalAbonos', 'TotalAbonos', 'totalAbonado', 'TotalAbonado', 'abonos', 'Abonos'], '$ 0,00') : '$ 0,00';
  const creditBalance = item ? getAccountStatementDisplayMoney(item, ['saldoFavor', 'SaldoFavor', 'saldoAFavor', 'SaldoAFavor'], '$ 0,00') : '$ 0,00';
  const settledDocuments = item ? getAccountStatementNumber(item, ['documentosSaldados', 'DocumentosSaldados', 'facturasSaldadas', 'FacturasSaldadas'], 0) : 0;

  return (
    <Modal visible={Boolean(item)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.accountModalOverlay}>
        <Pressable style={styles.detailModalBackdrop} onPress={onClose} />
        <View style={styles.accountModalCard}>
          <View style={styles.accountModalHeader}>
            <View style={styles.detailModalTitleWrap}>
              <Text style={styles.detailModalEyebrow}>ESTADO DE CUENTA</Text>
              <Text style={styles.accountModalTitle} numberOfLines={2}>{item?.title || 'Cliente'}</Text>
              <Text style={styles.clientMeta}>{identification ? `RUC/CI: ${identification}` : 'Sin identificacion'}</Text>
            </View>
            <Pressable accessibilityLabel="Cerrar detalle" style={styles.detailModalClose} onPress={onClose}>
              <Text style={styles.detailModalCloseText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.accountModalChips}>
            {email ? <AccountInfoChip icon="email-outline" label={email} /> : null}
            <AccountInfoChip icon="file-document-outline" label={`${invoiceCount} factura(s)`} />
            <AccountInfoChip icon="wallet-outline" label={balance} />
          </View>
          <View style={styles.accountModalStats}>
            <AccountModalStat icon="wallet-outline" label="Saldo total" value={balance} danger />
            <AccountModalStat icon="file-document-outline" label="Facturas pendientes" value={invoiceCount} />
            <AccountModalStat icon="calendar-check-outline" label="Ultimo abono" value={lastPayment} />
            <AccountModalStat icon="clock-outline" label="Dias vencidos" value={daysOverdue} success={String(daysOverdue).startsWith('0')} />
          </View>
          <View style={styles.accountModalTabs}>
            {(['Historial', 'Facturas', 'Abonos', 'Resumen'] as AccountStatementTab[]).map((tab) => (
              <Pressable key={tab} style={[styles.accountModalTab, activeTab === tab && styles.accountModalTabActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.accountModalTabText, activeTab === tab && styles.accountModalTabTextActive]}>{tab}</Text>
              </Pressable>
            ))}
          </View>
          {activeTab === 'Historial' ? <AccountStatementHistory movements={movements} /> : null}
          {activeTab === 'Facturas' ? <AccountStatementInvoices invoices={invoices} /> : null}
          {activeTab === 'Abonos' ? <AccountStatementPayments payments={payments} /> : null}
          {activeTab === 'Resumen' ? (
            <View style={styles.accountSummaryGrid}>
              <AccountSummaryBox label="Total facturado" value={totalBilled} />
              <AccountSummaryBox label="Total abonado" value={totalPaid} />
              <AccountSummaryBox label="Saldo a favor" value={creditBalance} />
              <AccountSummaryBox label="Documentos saldados" value={settledDocuments} />
            </View>
          ) : null}
          <View style={styles.accountModalActions}>
            <Pressable style={[styles.accountModalActionButton, styles.accountModalRegisterButton]} onPress={onRegister}>
              <MaterialCommunityIcons name="cash-plus" size={17} color="#128A46" />
              <Text style={styles.accountModalRegisterText}>Registrar abono</Text>
            </Pressable>
            <Pressable style={styles.accountModalActionButton} onPress={() => onDownloadFile('pdf')}>
              <MaterialCommunityIcons name="download-outline" size={17} color="#315A7A" />
              <Text style={styles.accountModalActionText}>Descargar PDF</Text>
            </Pressable>
            <Pressable style={styles.accountModalActionButton} onPress={onViewFile}>
              <MaterialCommunityIcons name="eye-outline" size={17} color="#315A7A" />
              <Text style={styles.accountModalActionText}>Ver PDF</Text>
            </Pressable>
            <Pressable style={styles.accountModalActionButton} onPress={() => onDownloadFile('excel')}>
              <MaterialCommunityIcons name="file-excel-outline" size={17} color="#128A46" />
              <Text style={styles.accountModalActionText}>Descargar Excel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type AccountStatementTab = 'Historial' | 'Facturas' | 'Abonos' | 'Resumen';

type AccountStatementMovement = {
  date: string;
  document: string;
  concept: string;
  debit?: string;
  credit?: string;
  balance: string;
  status?: string;
};

function AccountStatementHistory({ movements }: { movements: AccountStatementMovement[] }) {
  return (
    <View style={styles.accountMovementTable}>
      <View style={styles.accountMovementHeader}>
        <Text style={styles.accountMovementHeaderText}>Fecha</Text>
        <Text style={styles.accountMovementHeaderText}>Documento</Text>
        <Text style={styles.accountMovementHeaderText}>Saldo</Text>
      </View>
      {movements.map((movement, index) => (
        <View key={`movement-${index}`} style={styles.accountMovementRow}>
          <Text style={styles.accountMovementText}>{movement.date}</Text>
          <View style={styles.accountMovementDocument}>
            <Text style={styles.accountMovementTitle}>{movement.document}</Text>
            <Text style={styles.accountMovementConcept}>{movement.concept}</Text>
          </View>
          <Text style={styles.accountMovementAmount}>{movement.balance}</Text>
        </View>
      ))}
    </View>
  );
}

function AccountStatementInvoices({ invoices }: { invoices: AccountStatementMovement[] }) {
  return (
    <View style={styles.accountTabList}>
      {invoices.map((invoice, index) => (
        <View key={`invoice-${index}`} style={styles.accountDocumentCard}>
          <View style={styles.accountDocumentMain}>
            <Text style={styles.accountDocumentTitle}>{invoice.document}</Text>
            <Text style={styles.accountDocumentMeta}>{invoice.date} · vence {invoice.concept || '-'}</Text>
          </View>
          <View style={styles.accountDocumentRight}>
            <Text style={styles.accountDocumentAmount}>{invoice.balance}</Text>
            <View style={[styles.accountStatusPill, styles.accountStatusPending]}>
              <Text style={[styles.accountStatusText, styles.accountStatusTextPending]}>{invoice.status || 'Pendiente'}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function AccountStatementPayments({ payments }: { payments: AccountStatementMovement[] }) {
  if (!payments.length) {
    return <View style={styles.accountEmptyTab}><Text style={styles.accountEmptyTabText}>Sin abonos registrados para este cliente.</Text></View>;
  }

  return (
    <View style={styles.accountMovementTable}>
      <View style={styles.accountMovementHeader}>
        <Text style={styles.accountMovementHeaderText}>Fecha</Text>
        <Text style={styles.accountMovementHeaderText}>Abono</Text>
        <Text style={styles.accountMovementHeaderText}>Valor</Text>
      </View>
      {payments.map((payment, index) => (
        <View key={`payment-${index}`} style={styles.accountMovementRow}>
          <Text style={styles.accountMovementText}>{payment.date}</Text>
          <View style={styles.accountMovementDocument}>
            <Text style={styles.accountMovementTitle}>{payment.document}</Text>
            <Text style={styles.accountMovementConcept}>{payment.concept}</Text>
          </View>
          <Text style={styles.accountMovementAmount}>{payment.credit || payment.balance}</Text>
        </View>
      ))}
    </View>
  );
}

function AccountSummaryBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.accountSummaryBox}>
      <Text style={styles.accountSummaryLabel}>{label}</Text>
      <Text style={styles.accountSummaryValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function AccountInfoChip({ icon, label }: { icon: ComponentProps<typeof MaterialCommunityIcons>['name']; label: string }) {
  return (
    <View style={styles.accountInfoChip}>
      <MaterialCommunityIcons name={icon} size={14} color="#0870BE" />
      <Text style={styles.accountInfoChipText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function AccountModalStat({ icon, label, value, danger, success }: { icon: ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string | number; danger?: boolean; success?: boolean }) {
  return (
    <View style={styles.accountModalStat}>
      <View style={[styles.accountMetricIcon, success ? styles.accountMetricGreen : danger ? styles.accountMetricOrange : styles.accountMetricBlue]}>
        <MaterialCommunityIcons name={icon} size={16} color={success ? '#0C8C57' : danger ? '#D92D3A' : '#0870BE'} />
      </View>
      <View style={styles.accountModalStatCopy}>
        <Text style={styles.accountMetricLabel}>{label}</Text>
        <Text style={[styles.accountModalStatValue, danger && styles.accountClientStatDanger, success && styles.accountModalStatSuccess]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
    </View>
  );
}

export function getAccountStatementClientId(item: OperationalMobileItem) {
  return getAccountStatementText(item, ['idCliente', 'IdCliente', 'codCliente', 'CodCliente', 'codigoCliente', 'CodigoCliente']) || item.id || '';
}

function getAccountStatementText(item: OperationalMobileItem, keys: string[]) {
  const value = getAccountStatementRawValue(item, keys);
  return value === null || value === undefined ? '' : String(value);
}

export function getAccountStatementNumber(item: OperationalMobileItem, keys: string[], fallback: number) {
  const value = getAccountStatementRawValue(item, keys);
  const numberValue = parseAccountStatementNumber(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function getAccountStatementAmount(item: OperationalMobileItem, keys: string[], fallback?: unknown) {
  const value = getAccountStatementRawValue(item, keys);
  const parsed = parseAccountStatementMoney(value);
  if (Number.isFinite(parsed)) return parsed;
  const fallbackParsed = parseAccountStatementMoney(fallback);
  return Number.isFinite(fallbackParsed) ? fallbackParsed : 0;
}

function getAccountStatementDisplayMoney(item: OperationalMobileItem, keys: string[], fallback?: unknown) {
  const value = getAccountStatementRawValue(item, keys);
  const parsed = parseAccountStatementMoney(value);
  if (Number.isFinite(parsed)) return formatMoney(parsed);
  const fallbackParsed = parseAccountStatementMoney(fallback);
  if (Number.isFinite(fallbackParsed)) return formatMoney(fallbackParsed);
  return typeof fallback === 'string' && fallback.trim() ? fallback : '$ 0,00';
}

function getAccountStatementRawValue(item: OperationalMobileItem, keys: string[]) {
  const row = item.raw ?? {};
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined) return row[key];
  }
  const normalized = keys.map((key) => normalizeText(key));
  return Object.entries(row).find(([key, value]) => value !== null && value !== undefined && normalized.includes(normalizeText(key)))?.[1];
}

function parseAccountStatementNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseAccountStatementMoney(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  const normalized = value.replace(/[^\d,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getAccountStatementMovements(item: OperationalMobileItem) {
  const rawMovements = getAccountStatementRawValue(item, ['movimientos', 'Movimientos', 'historial', 'Historial', 'detalle', 'Detalle']);
  const rows = Array.isArray(rawMovements) ? rawMovements.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)) : [];
  const balance = getAccountStatementDisplayMoney(item, ['saldoTotalCliente', 'SaldoTotalCliente', 'saldoActual', 'SaldoActual', 'saldoPendiente', 'SaldoPendiente', 'saldo', 'Saldo'], item.meta);
  const fallbackRow = {
    date: getAccountStatementText(item, ['fecha', 'Fecha', 'fechaEmision', 'FechaEmision', 'fechaUltimoAbono', 'FechaUltimoAbono']) || '-',
    document: getAccountStatementText(item, ['numeroFactura', 'NumeroFactura', 'numeroDocumento', 'NumeroDocumento', 'documento', 'Documento']) || item.detail || item.id || 'Factura',
    concept: 'Factura',
    balance,
  };

  if (!rows.length) return [fallbackRow];

  return rows.slice(0, 4).map((row) => {
    const movementItem: OperationalMobileItem = { id: '', title: '', raw: row };
    return {
      date: getAccountStatementText(movementItem, ['fecha', 'Fecha', 'fechaEmision', 'FechaEmision']) || '-',
      document: getAccountStatementText(movementItem, ['documento', 'Documento', 'numeroDocumento', 'NumeroDocumento', 'numeroFactura', 'NumeroFactura']) || 'Movimiento',
      concept: getAccountStatementText(movementItem, ['concepto', 'Concepto', 'tipo', 'Tipo']) || 'Movimiento',
      debit: getAccountStatementDisplayMoney(movementItem, ['debito', 'Debito', 'debe', 'Debe'], '$ 0,00'),
      credit: getAccountStatementDisplayMoney(movementItem, ['credito', 'Credito', 'haber', 'Haber'], '$ 0,00'),
      balance: getAccountStatementDisplayMoney(movementItem, ['saldo', 'Saldo', 'saldoActual', 'SaldoActual'], balance),
    };
  });
}

function getAccountStatementInvoices(item: OperationalMobileItem): AccountStatementMovement[] {
  const rawInvoices = getAccountStatementRawValue(item, ['facturasDetalle', 'FacturasDetalle', 'facturas', 'Facturas', 'documentos', 'Documentos']);
  const rows = Array.isArray(rawInvoices) ? rawInvoices.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)) : [];
  if (!rows.length) {
    return getAccountStatementMovements(item).map((movement) => ({ ...movement, status: item.status || 'Pendiente' }));
  }

  return rows.slice(0, 4).map((row) => {
    const invoiceItem: OperationalMobileItem = { id: '', title: '', raw: row };
    return {
      date: getAccountStatementText(invoiceItem, ['fecha', 'Fecha', 'fechaEmision', 'FechaEmision']) || '-',
      document: getAccountStatementText(invoiceItem, ['numeroFactura', 'NumeroFactura', 'numeroDocumento', 'NumeroDocumento', 'documento', 'Documento']) || 'Factura',
      concept: getAccountStatementText(invoiceItem, ['fechaVencimiento', 'FechaVencimiento', 'vence', 'Vence']) || '-',
      balance: getAccountStatementDisplayMoney(invoiceItem, ['saldo', 'Saldo', 'saldoPendiente', 'SaldoPendiente', 'total', 'Total'], '$ 0,00'),
      status: getAccountStatementText(invoiceItem, ['estado', 'Estado', 'estadoPago', 'EstadoPago']) || 'Pendiente',
    };
  });
}

function getAccountStatementPayments(item: OperationalMobileItem): AccountStatementMovement[] {
  const rawPayments = getAccountStatementRawValue(item, ['abonosDetalle', 'AbonosDetalle', 'pagos', 'Pagos', 'abonos', 'Abonos']);
  const rows = Array.isArray(rawPayments) ? rawPayments.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)) : [];

  return rows.slice(0, 4).map((row) => {
    const paymentItem: OperationalMobileItem = { id: '', title: '', raw: row };
    return {
      date: getAccountStatementText(paymentItem, ['fecha', 'Fecha', 'fechaAbono', 'FechaAbono', 'fechaPago', 'FechaPago']) || '-',
      document: getAccountStatementText(paymentItem, ['numero', 'Numero', 'comprobante', 'Comprobante', 'documento', 'Documento']) || 'Abono',
      concept: getAccountStatementText(paymentItem, ['observacion', 'Observacion', 'formaPago', 'FormaPago', 'concepto', 'Concepto']) || 'Abono registrado',
      credit: getAccountStatementDisplayMoney(paymentItem, ['valor', 'Valor', 'monto', 'Monto', 'credito', 'Credito'], '$ 0,00'),
      balance: getAccountStatementDisplayMoney(paymentItem, ['saldo', 'Saldo'], '$ 0,00'),
    };
  });
}

export function PurchaseDocumentsScreen({
  form,
  saving,
  message,
  onChange,
  onSelectPlan,
  onSave,
}: {
  form: OperationalFormState;
  saving: boolean;
  message?: MessageState;
  onChange: (field: 'codigo' | 'valor', value: string) => void;
  onSelectPlan: (documents: number, amount: number, unlimited: boolean) => void;
  onSave: () => void;
}) {
  const documents = Number(form.codigo) || 0;
  const amount = Number(form.valor.replace(',', '.')) || 0;
  const [localMessage, setLocalMessage] = useState<MessageState>(null);
  const plans = [
    { documents: 25, amount: 11.5, caption: 'Una recarga simple para comenzar.', color: '#EAF5FC' },
    { documents: 120, amount: 31.74, caption: 'Equilibrio ideal para tu operación diaria.', color: '#FFF6E5', recommended: true },
    { documents: 600, amount: 69, caption: 'Más documentos para una operación constante.', color: '#E8F8F3' },
    { documents: 0, amount: 90, caption: 'Emite sin descontar saldo por un año.', color: '#ECF8EE', unlimited: true },
  ];
  const selectPlan = (plan: typeof plans[number]) => {
    onSelectPlan(plan.documents, plan.amount, Boolean(plan.unlimited));
    setLocalMessage(null);
  };
  const confirm = () => {
    const unlimited = form.descripcion.toLowerCase().includes('ilimit');
    if ((!unlimited && documents < 11) || amount < 5) {
      setLocalMessage({ type: 'info', text: 'Ingresa al menos 11 documentos y un monto mínimo de $5,00.' });
      return;
    }
    if (amount > 1000) {
      setLocalMessage({ type: 'info', text: 'El monto máximo permitido para una recarga es de $1.000,00.' });
      return;
    }
    if (!Number.isFinite(documents) || !Number.isFinite(amount)) {
      setLocalMessage({ type: 'info', text: 'Verifica que la cantidad y el valor sean números válidos.' });
      return;
    }
    setLocalMessage(null);
    onSave();
  };
  const total = amount;
  const unlimited = form.descripcion.toLowerCase().includes('ilimit');
  const selectedPlanKey = unlimited ? 'unlimited' : `${documents}:${amount}`;

  return (
    <View style={styles.rechargePage}>
      <View style={styles.rechargeStatusBand}>
        <View style={styles.rechargeStatusIcon}>
          <MaterialCommunityIcons name="file-document-plus-outline" size={24} color="#0072BD" />
        </View>
        <View style={styles.rechargeStatusCopy}>
          <Text style={styles.rechargeEyebrow}>Compra documentos por recarga</Text>
          <Text style={styles.rechargeStatusTitle}>Saldo acreditado al aprobarse el pago</Text>
        </View>
        <View style={styles.rechargeStatusPill}>
          <Text style={styles.rechargeStatusPillText}>IVA incluido</Text>
        </View>
      </View>

      <View style={styles.rechargeHero}>
        <View style={styles.rechargeHeroHeader}>
          <View style={styles.rechargeStepBadge}>
            <Text style={styles.rechargeStepBadgeText}>1</Text>
          </View>
          <Text style={styles.rechargeEyebrow}>Recarga personalizada</Text>
        </View>
        <View style={styles.rechargeHeroCopy}>
          <Text style={styles.rechargeTitle}>Compra por documentos o por dinero</Text>
          <Text style={styles.rechargeText}>Edita cualquiera de los dos valores y el sistema calcula automáticamente el otro.</Text>
        </View>
        <View style={styles.rechargeInputs}>
          <View style={styles.rechargeInputBlock}>
            <Field label="¿Cuántos documentos deseas comprar? *" value={form.codigo} onChangeText={(value) => onChange('codigo', value)} keyboardType="number-pad" />
            <Text style={styles.rechargeHint}>Mínimo 11 documentos (equivalente a una recarga desde $5,00)</Text>
          </View>
          <View style={styles.rechargeInputBlock}>
            <Field label="Valor de la recarga *" value={form.valor} onChangeText={(value) => onChange('valor', value)} keyboardType="decimal-pad" />
            <Text style={styles.rechargeHint}>Monto mínimo de recarga: $5,00</Text>
          </View>
        </View>
      </View>

      <View style={styles.rechargeSummary}>
        <Text style={styles.rechargeEyebrow}>Resumen de compra</Text>
        <Text style={styles.rechargeSummaryTitle}>{documents || amount ? 'Tu recarga' : 'Selecciona una opción'}</Text>
        <View style={styles.rechargeSummaryHero}>
          <View>
            <Text style={styles.rechargeSummaryLabel}>Total a pagar</Text>
            <Text style={styles.rechargeSummaryTotal}>USD ${total.toFixed(2)}</Text>
          </View>
          <View style={styles.rechargeDocsPill}>
            <Text style={styles.rechargeDocsPillValue}>{unlimited ? '∞' : documents || 0}</Text>
            <Text style={styles.rechargeDocsPillLabel}>{unlimited ? 'documentos' : 'docs'}</Text>
          </View>
        </View>
        <View style={styles.rechargeSummaryRow}><Text style={styles.rechargeSummaryLabel}>Documentos</Text><Text style={styles.rechargeSummaryValue}>{unlimited ? 'Ilimitados' : documents || 0}</Text></View>
        <View style={styles.rechargeSummaryRow}><Text style={styles.rechargeSummaryLabel}>Vigencia</Text><Text style={styles.rechargeSummaryValue}>{unlimited ? '1 año' : 'Saldo disponible'}</Text></View>
        {localMessage ? <MessageBox message={localMessage} /> : null}
        {message ? <MessageBox message={message} /> : null}
        <PrimaryButton label="Confirmar recarga" loading={saving} onPress={confirm} />
        <View style={styles.rechargeSecureRow}>
          <MaterialCommunityIcons name="lock-check-outline" size={17} color="#7890A4" />
          <Text style={styles.rechargeSecure}>Pago 100% seguro{`\n`}El saldo se acredita automáticamente al aprobarse el pago.</Text>
        </View>
      </View>

      <View style={styles.rechargeSectionHeader}>
        <View>
          <Text style={styles.rechargeEyebrow}>Opciones recomendadas</Text>
          <Text style={styles.rechargeSectionTitle}>Elige una recarga rápida</Text>
        </View>
        <Text style={styles.rechargeVatHint}>Precios finales con IVA incluido</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rechargePlanGrid}
        decelerationRate="fast"
      >
        {plans.map((plan) => (
          <View key={plan.unlimited ? 'unlimited' : plan.documents} style={[styles.rechargePlan, { backgroundColor: plan.color }, selectedPlanKey === (plan.unlimited ? 'unlimited' : `${plan.documents}:${plan.amount}`) ? styles.rechargePlanSelected : null]}>
            <View style={styles.rechargePlanTop}>
              <View style={styles.rechargePlanIcon}>
                <MaterialCommunityIcons name={plan.unlimited ? 'creation' : plan.recommended ? 'briefcase-check-outline' : 'file-document-multiple-outline'} size={19} color="#0072BD" />
              </View>
              {plan.recommended ? <Text style={styles.rechargePlanBadge}>Recomendado</Text> : null}
            </View>
            {plan.unlimited ? <Text style={styles.rechargePlanDocuments}>Ilimitados</Text> : <Text style={styles.rechargePlanDocuments}>{plan.documents}</Text>}
            {!plan.unlimited ? <Text style={styles.rechargePlanUnit}>documentos</Text> : <Text style={styles.rechargePlanUnit}>durante 1 año</Text>}
            <Text style={styles.rechargePlanAmount}>USD ${plan.amount.toFixed(2)}</Text>
            <Text style={styles.rechargePlanCaption}>{plan.caption}</Text>
            <SecondaryButton label="Elegir plan  →" onPress={() => selectPlan(plan)} />
          </View>
        ))}
      </ScrollView>

    </View>
  );
}

