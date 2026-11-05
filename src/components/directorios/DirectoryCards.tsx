import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import type { CategoriaCatalogo, Cliente, Emisor, FirmaEstado, Producto } from '../../types/business';
import { EFACT_THEME } from '../../styles/theme';
import { formatMoney } from '../../utils/documentFormatting';
import { isConsumidorFinal } from '../../utils/clientDisplay';
import { getFirmaFileName, hasFirmaConfigured } from '../../utils/emisorDisplay';
import { CatalogCard } from '../catalog/CatalogCards';
import { styles } from '../../styles/appStyles';

export function ClienteCard({
  cliente,
  tipoClienteLabel,
  stats,
  onView,
  onEdit,
  onDelete,
}: {
  cliente: Cliente;
  tipoClienteLabel: string;
  stats: { facturasEmitidas: number; saldoPendiente: number };
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const name = cliente.nombrerazonsocial || cliente.nombrecomercial || [cliente.nombres, cliente.apellidos].filter(Boolean).join(' ') || 'Cliente sin nombre';
  const protectedSystem = isConsumidorFinal(cliente);
  const contact = cliente.correo || cliente.celular || cliente.telefonoconvencional || 'Sin contacto';

  return (
    <View style={[styles.clientCard, protectedSystem && styles.clientCardSystem]}>
      <View style={styles.clientCardHeader}>
        <View style={[styles.clientAvatar, protectedSystem && styles.clientAvatarSystem]}>
          <Text style={styles.clientAvatarText}>{protectedSystem ? 'CF' : name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{name}</Text>
          <Text style={styles.clientMeta}>{cliente.numeroidentificacion || 'Sin identificacion'}</Text>
        </View>
        {protectedSystem ? (
          <View style={styles.clientBadgeStack}>
            <View style={styles.systemPill}><Text style={styles.systemPillText}>Sistema</Text></View>
          </View>
        ) : null}
      </View>

      <View style={styles.clientDetailGrid}>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Contacto</Text><Text style={styles.clientDetailValue} numberOfLines={1}>{contact}</Text></View>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Tipo</Text><Text style={styles.clientDetailValue}>{tipoClienteLabel}</Text></View>
      </View>
      <View style={styles.clientStatsGrid}>
        <View style={styles.clientStatItem}><Text style={styles.clientDetailLabel}>Facturas emitidas</Text><Text style={styles.clientStatValue}>{stats.facturasEmitidas}</Text></View>
        <View style={styles.clientStatItem}><Text style={styles.clientDetailLabel}>Saldo pendiente</Text><Text style={styles.clientStatValue}>{formatMoney(stats.saldoPendiente)}</Text></View>
      </View>
      {protectedSystem ? (
        <View style={styles.clientActions}>
          <View style={styles.systemNoticeCompact}><Text style={styles.systemNoticeText}>Registro fijo para facturacion.</Text></View>
          <Pressable style={styles.smallActionButton} onPress={onView}><MaterialCommunityIcons name="eye-outline" size={16} color="#00649D" /><Text style={styles.smallActionText}>Ver</Text></Pressable>
        </View>
      ) : (
        <View style={styles.clientActions}>
          <Pressable style={styles.smallActionButton} onPress={onView}><MaterialCommunityIcons name="eye-outline" size={16} color="#00649D" /><Text style={styles.smallActionText}>Ver</Text></Pressable>
          <Pressable style={styles.smallActionButton} onPress={onEdit}><MaterialCommunityIcons name="pencil-outline" size={16} color="#00649D" /><Text style={styles.smallActionText}>Editar</Text></Pressable>
          <Pressable style={[styles.smallActionButton, styles.smallDangerButton]} onPress={onDelete}><MaterialCommunityIcons name="trash-can-outline" size={16} color="#B4232D" /><Text style={[styles.smallActionText, styles.smallDangerText]}>Eliminar</Text></Pressable>
        </View>
      )}
    </View>
  );
}

export function ProductoCard({ producto, onView, onEdit, onDelete }: { producto: Producto; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const precioBase = Number.isFinite(producto.precioBase) ? producto.precioBase : 0;
  const tarifa = producto.tarifaDescripcion ?? (producto.tarifa !== null && producto.tarifa !== undefined ? `${producto.tarifa}%` : null);
  const ivaTarifa = tarifa ? `Con IVA - ${tarifa}` : producto.iva ? 'Con IVA' : 'Sin IVA';
  const detail = [producto.codigo ? `Cod. ${producto.codigo}` : null, producto.categoriaDescripcion, producto.subcategoriaDescripcion].filter(Boolean).join(' - ');
  return (
    <View style={styles.clientCard}>
      <View style={styles.clientCardHeader}>
        <View style={styles.clientAvatar}><Text style={styles.clientAvatarText}>{producto.tipo === 'SERVICIO' ? 'S' : 'P'}</Text></View>
        <View style={styles.clientInfo}><Text style={styles.clientName}>{producto.nombre || 'Producto sin nombre'}</Text><Text style={styles.clientMeta}>{detail || (producto.tipo === 'SERVICIO' ? 'Servicio' : 'Producto')}</Text></View>
      </View>
      <View style={styles.clientDetailGrid}>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Precio base</Text><Text style={styles.clientDetailValue}>${precioBase.toFixed(2)}</Text></View>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>IVA / Tarifa</Text><Text style={styles.clientDetailValue} numberOfLines={1}>{ivaTarifa}</Text></View>
      </View>
      <View style={styles.clientDetailGrid}>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Categoria</Text><Text style={styles.clientDetailValue} numberOfLines={1}>{producto.categoriaDescripcion || 'Sin categoria'}</Text></View>
        <View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Subcategoria</Text><Text style={styles.clientDetailValue} numberOfLines={1}>{producto.subcategoriaDescripcion || 'Sin subcategoria'}</Text></View>
      </View>
      <DirectoryCardActions onView={onView} onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}

export function CategoriaCard({ categoria, onView, onEdit, onDelete }: { categoria: CategoriaCatalogo; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return <CatalogCard initials="C" title={categoria.descripcion || 'Categoria sin descripcion'} subtitle="Categoria" onView={onView} onEdit={onEdit} onDelete={onDelete} />;
}

export function EmisorCard({ emisor, onView, onEdit, onDelete }: { emisor: Emisor; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const title = emisor.razonSocial || emisor.nomComercial || 'Emisor sin nombre';
  const contact = [emisor.email, emisor.telefono].filter(Boolean).join(' - ') || 'Sin contacto';
  return (
    <View style={styles.clientCard}>
      <View style={styles.clientCardHeader}><View style={styles.clientAvatar}><Text style={styles.clientAvatarText}>E</Text></View><View style={styles.clientInfo}><Text style={styles.clientName}>{title}</Text><Text style={styles.clientMeta}>{emisor.ruc || 'Sin RUC'}</Text></View></View>
      <View style={styles.clientDetailGrid}><View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Nombre comercial</Text><Text style={styles.clientDetailValue} numberOfLines={1}>{emisor.nomComercial || 'Sin nombre comercial'}</Text></View><View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Contacto</Text><Text style={styles.clientDetailValue} numberOfLines={1}>{contact}</Text></View></View>
      <DirectoryCardActions onView={onView} onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
}

export function FirmaCard({ emisor, estado, onView, onEdit, onDelete }: { emisor: Emisor; estado?: FirmaEstado; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  const configured = hasFirmaConfigured(emisor) || estado?.tieneCertificado === true;
  const title = emisor.razonSocial || emisor.nomComercial || 'Emisor sin nombre';
  const status = !configured ? 'Pendiente' : estado?.esValida ? 'Vigente' : estado ? 'No valida' : 'Configurada';
  const daysColor = estado?.diasRestantes !== null && estado?.diasRestantes !== undefined
    ? estado.diasRestantes <= 30 ? EFACT_THEME.colors.warning : EFACT_THEME.colors.success
    : undefined;
  return (
    <View style={styles.clientCard}>
      <View style={styles.clientCardHeader}><View style={[styles.clientAvatar, configured && styles.clientAvatarSystem]}><Text style={styles.clientAvatarText}>F</Text></View><View style={styles.clientInfo}><Text style={styles.clientName}>{title}</Text><Text style={styles.clientMeta}>{emisor.ruc || 'Sin RUC'}</Text></View></View>
      <View style={[styles.clientDetailGrid, styles.firmaCompactGrid]}><View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Firma</Text><Text style={styles.clientDetailValue}>{status}</Text></View><View style={styles.clientDetailItem}><Text style={styles.clientDetailLabel}>Vigencia</Text><Text style={[styles.clientDetailValue, daysColor ? { color: daysColor } : null]}>{estado?.diasRestantes !== null && estado?.diasRestantes !== undefined ? `${estado.diasRestantes} dias` : 'No disponible'}</Text></View></View>
      <View style={styles.systemNoticeCompact}><Text style={styles.systemNoticeText} numberOfLines={2}>{configured ? `Archivo: ${getFirmaFileName(emisor.pathCertificado) || 'certificado configurado'}` : 'Carga el archivo .p12 y su clave para habilitar la firma.'}</Text></View>
      {estado?.esValida === false && estado.mensaje ? <View style={styles.systemNoticeCompact}><Text style={styles.systemNoticeText}>{estado.mensaje}</Text></View> : null}
      <View style={styles.clientActions}><Pressable style={styles.smallActionButton} onPress={onView}><MaterialCommunityIcons name="eye-outline" size={16} color="#00649D" /><Text style={styles.smallActionText}>Ver</Text></Pressable><Pressable style={[styles.smallActionButton, styles.smallSuccessButton]} onPress={onEdit}><MaterialCommunityIcons name="pencil-outline" size={16} color="#128A46" /><Text style={[styles.smallActionText, styles.smallSuccessText]}>{configured ? 'Cambiar firma' : 'Agregar firma'}</Text></Pressable><Pressable style={[styles.smallActionButton, styles.smallDangerButton]} onPress={onDelete}><MaterialCommunityIcons name="trash-can-outline" size={16} color="#B4232D" /><Text style={[styles.smallActionText, styles.smallDangerText]}>Eliminar</Text></Pressable></View>
    </View>
  );
}

function DirectoryCardActions({ onView, onEdit, onDelete }: { onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return <View style={styles.clientActions}><Pressable style={styles.smallActionButton} onPress={onView}><MaterialCommunityIcons name="eye-outline" size={16} color="#00649D" /><Text style={styles.smallActionText}>Ver</Text></Pressable><Pressable style={styles.smallActionButton} onPress={onEdit}><MaterialCommunityIcons name="pencil-outline" size={16} color="#00649D" /><Text style={styles.smallActionText}>Editar</Text></Pressable><Pressable style={[styles.smallActionButton, styles.smallDangerButton]} onPress={onDelete}><MaterialCommunityIcons name="trash-can-outline" size={16} color="#B4232D" /><Text style={[styles.smallActionText, styles.smallDangerText]}>Eliminar</Text></Pressable></View>;
}
