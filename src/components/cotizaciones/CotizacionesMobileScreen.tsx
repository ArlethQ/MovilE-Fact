import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ApiError } from '../../services/apiClient';
import { aprobarCotizacion, createCotizacion, darDeBajaCotizacion, emitirCotizacion, getCotizaciones, updateCotizacion, type Cotizacion, type CotizacionInput } from '../../services/cotizacionesMobileService';
import { getFacturaPreparacion, type FacturaPreparacion } from '../../services/facturasMobileService';
import { getClientes } from '../../services/clientesService';
import { getProductos } from '../../services/productosService';
import { getPuntosEmision } from '../../services/puntosEmisionService';
import type { Cliente, Producto, PuntosEmisionData } from '../../types/business';
import { EmptyState } from '../ui/FeedbackStates';
import { Field, MessageBox, type MessageState, PrimaryButton, SearchField, SecondaryButton } from '../ui/FormControls';
import { DropdownField } from '../ui/FormShared';
import { styles } from '../../styles/appStyles';
import { formatDocumentDate, formatMoney } from '../../utils/documentFormatting';
import { getClienteDisplayName, getClienteIdentification } from '../../utils/clientDisplay';
import { getIvaOptionValue, getIvaOptions } from '../../utils/facturaOptions';

type ProductOption = { codproducto: number; nombre: string; codigo?: string | null; precioBase: number; precios?: number[]; tarifa?: number | null };
type QuoteLine = { producto: ProductOption; cantidad: string; precio: string; descuento: string; tarifa: string; detalle: string };
type Editor = { id: number; titulo: string; cliente: Cliente | null; formaPago: string; fechaVigencia: string; detalle: string; lineas: QuoteLine[] };
type EmitTarget = { cotizacion: Cotizacion; emisor: number | null; serie: string };

function numberValue(value: string) {
  return Number(value.replace(',', '.')) || 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function lineAmounts(line: QuoteLine) {
  const cantidad = Math.max(1, Math.floor(numberValue(line.cantidad)));
  const precio = Math.max(0, roundMoney(numberValue(line.precio)));
  const bruto = roundMoney(cantidad * precio);
  const descuento = Math.min(bruto, Math.max(0, roundMoney(numberValue(line.descuento))));
  const base = roundMoney(Math.max(bruto - descuento, 0));
  const iva = roundMoney(base * Math.max(0, numberValue(line.tarifa)) / 100);
  return { bruto, descuento, base, iva, total: roundMoney(base + iva) };
}

function catalogPrice(producto: ProductOption) {
  const prices = [producto.precioBase, ...(producto.precios ?? [])];
  return prices.find((price) => Number.isFinite(price) && price > 0) ?? 0;
}

function dateInput(days = 15) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function productOption(producto: Producto): ProductOption {
  return {
    codproducto: producto.codproducto,
    nombre: producto.nombre || 'Producto / servicio',
    codigo: producto.codigo,
    precioBase: Number(producto.precioBase) || 0,
    precios: producto.precios,
    tarifa: producto.tarifa,
  };
}

function statusLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('factur')) return 'Facturada';
  if (normalized.includes('aprob')) return 'Aprobada';
  return 'Pendiente';
}

function statusStyle(value: string) {
  const status = statusLabel(value);
  if (status === 'Facturada') return styles.quoteStatusSuccess;
  if (status === 'Aprobada') return styles.quoteStatusInfo;
  return styles.quoteStatusPending;
}

export function CotizacionesMobileScreen({ userId, onValidateEmission, onPdf, onSharePdf }: {
  userId: number;
  onValidateEmission?: () => Promise<string | null>;
  onPdf?: (cotizacion: Cotizacion) => void;
  onSharePdf?: (cotizacion: Cotizacion) => void;
}) {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<ProductOption[]>([]);
  const [preparacion, setPreparacion] = useState<FacturaPreparacion | null>(null);
  const [puntos, setPuntos] = useState<PuntosEmisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [step, setStep] = useState(0);
  const [clientQuery, setClientQuery] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [emitTarget, setEmitTarget] = useState<EmitTarget | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [quoteResult, clientResult, productResult, preparationResult, pointsResult] = await Promise.allSettled([
        getCotizaciones(userId),
        getClientes(userId),
        getProductos(userId),
        getFacturaPreparacion(userId),
        getPuntosEmision(userId),
      ]);
      if (quoteResult.status === 'rejected') throw quoteResult.reason;
      setCotizaciones(quoteResult.value);
      if (clientResult.status === 'fulfilled') setClientes(clientResult.value.filter((item) => item.estado !== false));
      if (productResult.status === 'fulfilled') setProductos(productResult.value.filter((item) => item.estado !== false).map(productOption));
      if (preparationResult.status === 'fulfilled') setPreparacion(preparationResult.value);
      if (pointsResult.status === 'fulfilled') setPuntos(pointsResult.value);
      setMessage(null);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudieron cargar las cotizaciones.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [userId]);

  const visibleCotizaciones = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return cotizaciones.filter((item) => {
      const matchesText = !term || [item.titulo, item.nombreCliente, item.identificacionCliente, item.estado, item.id].some((value) => String(value ?? '').toLowerCase().includes(term));
      const status = statusLabel(item.estado);
      const matchesStatus = statusFilter === 0 || (statusFilter === 1 && status === 'Pendiente') || (statusFilter === 2 && status === 'Aprobada') || (statusFilter === 3 && status === 'Facturada');
      return matchesText && matchesStatus;
    });
  }, [cotizaciones, filter, statusFilter]);

  const totals = useMemo(() => ({
    total: visibleCotizaciones.reduce((sum, item) => sum + item.totalEstimado, 0),
    pending: visibleCotizaciones.filter((item) => statusLabel(item.estado) === 'Pendiente').length,
    approved: visibleCotizaciones.filter((item) => statusLabel(item.estado) === 'Aprobada').length,
  }), [visibleCotizaciones]);

  const startNew = () => {
    setEditor({ id: 0, titulo: 'Proforma', cliente: null, formaPago: '', fechaVigencia: dateInput(), detalle: '', lineas: [] });
    setClientQuery('');
    setProductQuery('');
    setStep(0);
    setMessage(null);
  };

  const editQuote = (quote: Cotizacion) => {
    const cliente = clientes.find((item) => item.codcliente === quote.idCliente) ?? null;
    setEditor({
      id: quote.id,
      titulo: quote.titulo,
      cliente,
      formaPago: quote.formaPago ?? '',
      fechaVigencia: quote.fechaVigencia?.slice(0, 10) ?? dateInput(),
      detalle: quote.detalle ?? '',
      lineas: quote.detalles.map((line) => {
        const producto = productos.find((item) => item.codproducto === line.codigoProducto) ?? { codproducto: line.codigoProducto, nombre: line.nombreProducto, precioBase: line.precioUnitario, tarifa: line.tarifaIva };
        return {
          producto,
          cantidad: String(line.cantidad),
          precio: String(line.precioUnitario > 0 ? line.precioUnitario : catalogPrice(producto)),
          descuento: String(line.descuento),
          tarifa: String(line.tarifaIva),
          detalle: line.detalle ?? '',
        };
      }),
    });
    setClientQuery(cliente ? getClienteDisplayName(cliente) : quote.nombreCliente);
    setProductQuery('');
    setStep(0);
    setMessage(null);
  };

  const selectClient = (cliente: Cliente) => {
    setEditor((current) => current ? { ...current, cliente } : current);
    setClientQuery(getClienteDisplayName(cliente));
  };

  const addProduct = (producto: ProductOption) => {
    setEditor((current) => {
      if (!current) return current;
      const existing = current.lineas.find((line) => line.producto.codproducto === producto.codproducto);
      if (existing) return { ...current, lineas: current.lineas.map((line) => line.producto.codproducto === producto.codproducto ? { ...line, cantidad: String(numberValue(line.cantidad) + 1) } : line) };
      return { ...current, lineas: [...current.lineas, { producto, cantidad: '1', precio: String(catalogPrice(producto)), descuento: '0', tarifa: String(producto.tarifa ?? 0), detalle: '' }] };
    });
    setProductQuery('');
  };

  const updateLine = (index: number, field: keyof Omit<QuoteLine, 'producto'>, value: string) => setEditor((current) => current ? { ...current, lineas: current.lineas.map((line, lineIndex) => lineIndex === index ? { ...line, [field]: value } : line) } : current);

  const save = async () => {
    if (!editor || saving) return;
    if (!editor.titulo.trim() || !editor.cliente || !editor.formaPago || !editor.lineas.length) {
      setMessage({ type: 'error', text: 'Completa título, cliente, forma de pago y al menos un producto.' });
      return;
    }
    setSaving(true);
    try {
      const input: CotizacionInput = {
        titulo: editor.titulo.trim(),
        idCliente: editor.cliente.codcliente,
        formaPago: editor.formaPago,
        fechaVigencia: editor.fechaVigencia || null,
        detalle: editor.detalle.trim() || null,
        detalles: editor.lineas.map((line) => {
          const amounts = lineAmounts(line);
          return {
          codigoProducto: line.producto.codproducto,
          precioUnitario: Math.max(0, roundMoney(numberValue(line.precio))),
          cantidad: Math.max(1, Math.floor(numberValue(line.cantidad))),
          descuento: amounts.descuento,
          tarifaIva: Math.max(0, numberValue(line.tarifa)),
          detalle: line.detalle.trim() || null,
          };
        }),
      };
      if (editor.id) await updateCotizacion(userId, editor.id, input);
      else await createCotizacion(userId, input);
      setEditor(null);
      await load();
      setMessage({ type: 'success', text: editor.id ? 'Cotización actualizada correctamente.' : 'Cotización creada correctamente.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo guardar la cotización.' });
    } finally {
      setSaving(false);
    }
  };

  const approve = (quote: Cotizacion) => Alert.alert('Aprobar cotización', `¿Aprobar “${quote.titulo}”? Después no podrá editarse.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Aprobar', onPress: async () => { try { await aprobarCotizacion(userId, quote.id); await load(); setMessage({ type: 'success', text: 'Cotización aprobada correctamente.' }); } catch (error) { setMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo aprobar la cotización.' }); } } },
  ]);

  const remove = (quote: Cotizacion) => Alert.alert('Eliminar cotización', `¿Eliminar “${quote.titulo}”? Esta acción no se puede deshacer.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await darDeBajaCotizacion(userId, quote.id); await load(); setMessage({ type: 'success', text: 'Cotización eliminada correctamente.' }); } catch (error) { setMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo eliminar la cotización.' }); } } },
  ]);

  const series = useMemo(() => {
    const prepared = (preparacion?.series ?? []).filter((item) => item.serieRaw && item.codemisor);
    if (prepared.length) return prepared;
    return (puntos?.cajas ?? []).filter((item) => item.serieFactura && item.codemisor).map((item) => ({ serieRaw: item.serieFactura, serieVisual: item.serieFactura, codemisor: item.codemisor }));
  }, [preparacion, puntos]);

  const startEmit = async (quote: Cotizacion) => {
    const prerequisitesError = await onValidateEmission?.();
    if (prerequisitesError) {
      setMessage({ type: 'error', text: prerequisitesError });
      return;
    }
    const firstSeries = series[0];
    const firstEmitter = preparacion?.emisores?.find((item) => item.codigo === firstSeries?.codemisor)?.codigo ?? firstSeries?.codemisor ?? null;
    if (!firstEmitter || !firstSeries?.serieRaw) {
      setMessage({ type: 'error', text: 'No hay emisor y serie configurados para emitir la factura.' });
      return;
    }
    setEmitTarget({ cotizacion: quote, emisor: firstEmitter, serie: firstSeries.serieRaw });
  };

  const confirmEmit = async () => {
    if (!emitTarget?.emisor || !emitTarget.serie) return;
    setSaving(true);
    try {
      const result = await emitirCotizacion(userId, emitTarget.cotizacion.id, emitTarget.emisor, emitTarget.serie);
      setEmitTarget(null);
      await load();
      setMessage({ type: 'success', text: result.mensaje || 'Factura emitida desde la cotización.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof ApiError ? error.message : 'No se pudo emitir la factura.' });
    } finally {
      setSaving(false);
    }
  };

  if (editor) return <QuoteEditor editor={editor} step={step} saving={saving} clientes={clientes} productos={productos} preparacion={preparacion} clientQuery={clientQuery} productQuery={productQuery} message={message} onChange={(field, value) => setEditor((current) => current ? { ...current, [field]: value } : current)} onSelectClient={selectClient} onSelectProduct={addProduct} onClientQuery={setClientQuery} onProductQuery={setProductQuery} onUpdateLine={updateLine} onRemoveLine={(index) => setEditor((current) => current ? { ...current, lineas: current.lineas.filter((_, lineIndex) => lineIndex !== index) } : current)} onStep={setStep} onSave={save} onCancel={() => setEditor(null)} />;

  return (
    <View>
      <View style={styles.quoteHero}>
        <View style={styles.quoteHeroIcon}><MaterialCommunityIcons name="file-document-edit-outline" size={28} color="#FFFFFF" /></View>
        <View style={styles.quoteHeroCopy}><Text style={styles.quoteHeroEyebrow}>VENTA COMERCIAL</Text><Text style={styles.quoteHeroTitle}>Cotizaciones</Text><Text style={styles.quoteHeroText}>Prepara proformas, apruébalas y conviértelas en factura desde el celular.</Text></View>
      </View>
      <View style={styles.quoteStatsRow}><QuoteStat label="Visibles" value={visibleCotizaciones.length} /><QuoteStat label="Pendientes" value={totals.pending} /><QuoteStat label="Aprobadas" value={totals.approved} /><QuoteStat label="Total" value={formatMoney(totals.total)} /></View>
      <View style={styles.quoteToolbar}><PrimaryButton label="Nueva cotización" loading={false} onPress={startNew} /><SecondaryButton label="Actualizar" onPress={() => void load()} /></View>
      <SearchField label="Buscar cotizaciones" placeholder="Título, cliente o identificación" value={filter} onChangeText={setFilter} resultCount={visibleCotizaciones.length} totalCount={cotizaciones.length} />
      <DropdownField label="Estado" options={[{ label: 'Todos', value: 0 }, { label: 'Pendientes', value: 1 }, { label: 'Aprobadas', value: 2 }, { label: 'Facturadas', value: 3 }]} value={statusFilter} onChange={(value) => setStatusFilter(value ?? 0)} />
      {message ? <MessageBox message={message} /> : null}
      {loading ? <View style={styles.directoryLoading}><ActivityIndicator color="#0072BD" /><Text style={styles.mutedText}>Cargando cotizaciones...</Text></View> : null}
      {!loading && !visibleCotizaciones.length ? <EmptyState title="Sin cotizaciones" text="Crea tu primera proforma desde el botón Nueva cotización." /> : null}
      <View style={styles.quoteList}>
        {visibleCotizaciones.map((quote) => {
          const expanded = expandedId === quote.id;
          const status = statusLabel(quote.estado);
          return <View key={`cotizacion-${quote.id}`} style={styles.quoteCard}>
            <Pressable style={styles.quoteCardHeader} onPress={() => setExpandedId(expanded ? null : quote.id)}>
              <View style={styles.quoteCardIcon}><MaterialCommunityIcons name="file-document-outline" size={22} color="#0072BD" /></View>
              <View style={styles.quoteCardMain}><Text style={styles.quoteCardTitle} numberOfLines={2}>{quote.titulo}</Text><Text style={styles.quoteCardClient} numberOfLines={1}>{quote.nombreCliente}</Text><Text style={styles.quoteCardMeta}>{formatDocumentDate(quote.fechaCreacion)} · {quote.detalles.length} línea(s)</Text></View>
              <View style={styles.quoteCardAmount}><Text style={styles.quoteCardTotal}>{formatMoney(quote.totalEstimado)}</Text><Text style={[styles.quoteStatus, statusStyle(quote.estado)]}>{status}</Text></View>
            </Pressable>
            {expanded ? <View style={styles.quoteExpanded}><Text style={styles.quoteSectionTitle}>Detalle de la proforma</Text>{quote.detalles.map((line, index) => <View key={`quote-line-${quote.id}-${index}`} style={styles.quoteLine}><View style={styles.quoteLineCopy}><Text style={styles.quoteLineName} numberOfLines={2}>{line.nombreProducto}</Text><Text style={styles.quoteLineMeta}>{line.cantidad} × {formatMoney(line.precioUnitario)} · IVA {line.tarifaIva}%</Text></View><Text style={styles.quoteLineTotal}>{formatMoney(line.totalLinea)}</Text></View>)}{quote.detalle ? <Text style={styles.quoteNote}>{quote.detalle}</Text> : null}<View style={styles.quoteActions}>{status === 'Pendiente' ? <><SecondaryButton label="Editar" onPress={() => editQuote(quote)} /><SecondaryButton label="Aprobar" accentColor="#0F8A4B" onPress={() => approve(quote)} /></> : null}<SecondaryButton label="Reutilizar" onPress={() => editQuote({ ...quote, id: 0, titulo: `${quote.titulo} (copia)` })} /><SecondaryButton label="Ver PDF" onPress={() => onPdf?.(quote)} /><SecondaryButton label="Compartir" onPress={() => onSharePdf?.(quote)} />{status === 'Aprobada' && !quote.codFactura ? <PrimaryButton label="Emitir factura" loading={false} onPress={() => startEmit(quote)} /> : null}{status !== 'Facturada' ? <SecondaryButton label="Eliminar" accentColor="#B42318" onPress={() => remove(quote)} /> : null}</View></View> : null}
          </View>;
        })}
      </View>
      <Modal transparent visible={Boolean(emitTarget)} animationType="slide" onRequestClose={() => setEmitTarget(null)}>
        <View style={styles.quoteModalOverlay}><View style={styles.quoteEmitModal}><Text style={styles.quoteModalTitle}>Emitir factura</Text><Text style={styles.quoteModalText}>Confirma el emisor y la serie para convertir esta cotización en factura.</Text><DropdownField label="Emisor" options={(preparacion?.emisores ?? []).filter((item) => item.codigo).map((item, index) => ({ label: item.razonSocial || item.razonsocial || `Emisor ${index + 1}`, value: item.codigo! }))} value={emitTarget?.emisor ?? null} onChange={(value) => { const selected = series.find((item) => item.codemisor === value); setEmitTarget((current) => current ? { ...current, emisor: value, serie: selected?.serieRaw ?? '' } : current); }} /><DropdownField label="Serie" options={series.filter((item) => !emitTarget?.emisor || item.codemisor === emitTarget.emisor).map((item, index) => ({ label: item.serieVisual || item.serieRaw || `Serie ${index + 1}`, value: index + 1 }))} value={Math.max(series.findIndex((item) => item.serieRaw === emitTarget?.serie && (!emitTarget?.emisor || item.codemisor === emitTarget.emisor)) + 1, 0) || null} onChange={(value) => { const selected = series.filter((item) => !emitTarget?.emisor || item.codemisor === emitTarget.emisor)[(value ?? 1) - 1]; setEmitTarget((current) => current ? { ...current, serie: selected?.serieRaw ?? '' } : current); }} /><View style={styles.quoteModalActions}><SecondaryButton label="Cancelar" onPress={() => setEmitTarget(null)} /><PrimaryButton label="Emitir" loading={saving} onPress={() => void confirmEmit()} /></View></View></View>
      </Modal>
    </View>
  );
}

function QuoteEditor({ editor, step, saving, clientes, productos, preparacion, clientQuery, productQuery, message, onChange, onSelectClient, onSelectProduct, onClientQuery, onProductQuery, onUpdateLine, onRemoveLine, onStep, onSave, onCancel }: {
  editor: Editor; step: number; saving: boolean; clientes: Cliente[]; productos: ProductOption[]; preparacion: FacturaPreparacion | null; clientQuery: string; productQuery: string; message: MessageState;
  onChange: (field: 'titulo' | 'formaPago' | 'fechaVigencia' | 'detalle', value: string) => void; onSelectClient: (cliente: Cliente) => void; onSelectProduct: (producto: ProductOption) => void; onClientQuery: (value: string) => void; onProductQuery: (value: string) => void; onUpdateLine: (index: number, field: keyof Omit<QuoteLine, 'producto'>, value: string) => void; onRemoveLine: (index: number) => void; onStep: (step: number) => void; onSave: () => void; onCancel: () => void;
}) {
  const ivaOptions = getIvaOptions(preparacion);
  const paymentOptions = preparacion?.formasPago ?? [];
  const clientSuggestions = clientes.filter((item) => `${getClienteDisplayName(item)} ${getClienteIdentification(item)}`.toLowerCase().includes(clientQuery.trim().toLowerCase())).slice(0, 5);
  const productSuggestions = productos.filter((item) => `${item.nombre} ${item.codigo ?? ''} ${item.codproducto}`.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 5);
  const totals = editor.lineas.reduce((acc, line) => { const amounts = lineAmounts(line); return { base: acc.base + amounts.base, discount: acc.discount + amounts.descuento, iva: acc.iva + amounts.iva, total: acc.total + amounts.total }; }, { base: 0, discount: 0, iva: 0, total: 0 });
  return <View><View style={styles.quoteEditorHeader}><Pressable onPress={onCancel} style={styles.quoteBackButton}><MaterialCommunityIcons name="arrow-left" size={20} color="#0072BD" /><Text style={styles.quoteBackText}>Cotizaciones</Text></Pressable><Text style={styles.quoteEditorTitle}>{editor.id ? 'Editar cotización' : 'Nueva cotización'}</Text><Text style={styles.quoteEditorText}>Completa la proforma en tres pasos claros y cómodos para cualquier pantalla.</Text></View><View style={styles.quoteStepper}>{['Datos', 'Productos', 'Revisión'].map((label, index) => <Pressable key={label} style={[styles.quoteStep, index === step && styles.quoteStepActive]} onPress={() => index <= step && onStep(index)}><Text style={[styles.quoteStepNumber, index === step && styles.quoteStepNumberActive]}>{index + 1}</Text><Text style={[styles.quoteStepLabel, index === step && styles.quoteStepLabelActive]}>{label}</Text></Pressable>)}</View>{message ? <MessageBox message={message} /> : null}{step === 0 ? <><View style={styles.quoteSection}><Text style={styles.quoteSectionTitle}>Información general</Text><Field label="Título de la cotización *" value={editor.titulo} onChangeText={(value) => onChange('titulo', value)} /><SearchField label="Cliente *" placeholder="Nombre, RUC o cédula" value={clientQuery} onChangeText={onClientQuery} predictive suggestions={clientSuggestions.map((item) => ({ id: String(item.codcliente), title: getClienteDisplayName(item), subtitle: getClienteIdentification(item) || 'Sin identificación' }))} onSelectSuggestion={(suggestion) => { const selected = clientes.find((item) => String(item.codcliente) === suggestion.id); if (selected) onSelectClient(selected); }} />{editor.cliente ? <Text style={styles.quoteSelectedText}>Seleccionado: {getClienteDisplayName(editor.cliente)}</Text> : null}<View style={styles.quoteFieldStack}><DropdownField label="Forma de pago *" options={paymentOptions.map((item, index) => ({ label: String(item.descripcionSri || item.descripcion || item.codigo || `Forma ${index + 1}`), value: index + 1 }))} value={Math.max(paymentOptions.findIndex((item) => String(item.codigo ?? '') === editor.formaPago) + 1, 0) || null} onChange={(value) => onChange('formaPago', value ? String(paymentOptions[value - 1]?.codigo ?? '') : '')} /><Field label="Vigencia (AAAA-MM-DD) *" value={editor.fechaVigencia} onChangeText={(value) => onChange('fechaVigencia', value)} keyboardType="default" /><Field label="Observaciones" value={editor.detalle} onChangeText={(value) => onChange('detalle', value)} /></View></View><View style={styles.quoteEditorActions}><SecondaryButton label="Cancelar" onPress={onCancel} /><PrimaryButton label="Continuar" loading={false} onPress={() => editor.cliente && editor.formaPago ? onStep(1) : undefined} /></View></> : null}{step === 1 ? <><View style={styles.quoteSection}><Text style={styles.quoteSectionTitle}>Productos y servicios</Text><SearchField label="Agregar producto o servicio" placeholder="Nombre, código o descripción" value={productQuery} onChangeText={onProductQuery} predictive suggestions={productSuggestions.map((item) => ({ id: String(item.codproducto), title: item.nombre, subtitle: `${item.codigo || item.codproducto} · ${formatMoney(item.precioBase)}` }))} onSelectSuggestion={(suggestion) => { const selected = productos.find((item) => String(item.codproducto) === suggestion.id); if (selected) onSelectProduct(selected); }} />{!editor.lineas.length ? <EmptyState title="Sin productos" text="Agrega al menos un producto o servicio para continuar." /> : null}{editor.lineas.map((line, index) => { const amounts = lineAmounts(line); return <View key={`editor-line-${line.producto.codproducto}`} style={styles.quoteEditorLine}><View style={styles.quoteLineHeader}><View style={styles.quoteLineCopy}><Text style={styles.quoteLineName}>{line.producto.nombre}</Text><Text style={styles.quoteLineMeta}>{line.producto.codigo || line.producto.codproducto}</Text></View><Text style={styles.quoteLineTotal}>{formatMoney(amounts.total)}</Text></View><Field label="Detalle de línea" value={line.detalle} onChangeText={(value) => onUpdateLine(index, 'detalle', value)} /><View style={styles.quoteLineFields}><View style={styles.quoteLineField}><Field label="Cantidad" value={line.cantidad} onChangeText={(value) => onUpdateLine(index, 'cantidad', value)} keyboardType="number-pad" /></View><View style={styles.quoteLineField}><Field label="Precio" value={line.precio} onChangeText={(value) => onUpdateLine(index, 'precio', value)} keyboardType="decimal-pad" /></View></View><View style={styles.quoteLineFields}><View style={styles.quoteLineField}><Field label="Descuento" value={line.descuento} onChangeText={(value) => onUpdateLine(index, 'descuento', value)} keyboardType="decimal-pad" /></View><View style={styles.quoteLineField}>{ivaOptions.length ? <DropdownField label="IVA" options={ivaOptions} value={getIvaOptionValue(ivaOptions, numberValue(line.tarifa))} onChange={(value) => onUpdateLine(index, 'tarifa', String(value ?? 0))} allowClear /> : <Field label="IVA %" value={line.tarifa} onChangeText={(value) => onUpdateLine(index, 'tarifa', value)} keyboardType="decimal-pad" />}</View></View><SecondaryButton label="Quitar producto" accentColor="#B42318" onPress={() => onRemoveLine(index)} /></View>; })}</View><View style={styles.quoteEditorActions}><SecondaryButton label="Volver" onPress={() => onStep(0)} /><PrimaryButton label="Revisar" loading={false} onPress={() => editor.lineas.length && onStep(2)} /></View></> : null}{step === 2 ? <><View style={styles.quoteSection}><Text style={styles.quoteSectionTitle}>Revisión y total estimado</Text><View style={styles.quoteReviewClient}><Text style={styles.quoteReviewLabel}>Cliente</Text><Text style={styles.quoteReviewValue}>{editor.cliente ? getClienteDisplayName(editor.cliente) : 'Sin seleccionar'}</Text><Text style={styles.quoteReviewMeta}>{editor.formaPago || 'Sin forma de pago'} · Vigente hasta {editor.fechaVigencia || 'sin fecha'}</Text></View>{editor.lineas.map((line) => { const amounts = lineAmounts(line); return <View key={`review-${line.producto.codproducto}`} style={styles.quoteLine}><View style={styles.quoteLineCopy}><Text style={styles.quoteLineName}>{line.producto.nombre}</Text><Text style={styles.quoteLineMeta}>{line.cantidad} × {formatMoney(numberValue(line.precio))}</Text></View><Text style={styles.quoteLineTotal}>{formatMoney(amounts.total)}</Text></View>; })}<View style={styles.quoteTotals}><QuoteTotal label="Subtotal" value={totals.base} /><QuoteTotal label="Descuentos" value={totals.discount} /><QuoteTotal label="IVA" value={totals.iva} /><QuoteTotal label="Total estimado" value={totals.total} strong /></View></View><View style={styles.quoteEditorActions}><SecondaryButton label="Volver" onPress={() => onStep(1)} /><PrimaryButton label={editor.id ? 'Guardar cambios' : 'Crear cotización'} loading={saving} onPress={onSave} /></View></> : null}</View>;
}

function QuoteStat({ label, value }: { label: string; value: string | number }) { return <View style={styles.quoteStat}><Text style={styles.quoteStatValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.quoteStatLabel}>{label}</Text></View>; }
function QuoteTotal({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <View style={styles.quoteTotal}><Text style={[styles.quoteTotalLabel, strong && styles.quoteTotalLabelStrong]}>{label}</Text><Text style={[styles.quoteTotalValue, strong && styles.quoteTotalValueStrong]}>{formatMoney(value)}</Text></View>; }
