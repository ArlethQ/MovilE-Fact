import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AdminMobileItem } from '../../services/adminMobileService';
import { EmptyState } from '../ui/FeedbackStates';
import { MessageBox, MessageState, SearchField } from '../ui/FormControls';
import { ItemDetailModal, ResultCollection } from '../data/ResultCollection';
import { styles } from '../../styles/appStyles';

type AdminModuleConfig = {
  eyebrow: string;
  title: string;
  description: string;
  tabs?: string[];
  placeholder: string;
  action?: string;
};

const adminModuleSlugs: Record<string, string> = {
  'admin-cajas-secuencias': 'cajas-secuencias',
  'admin-roles-permisos': 'roles-permisos',
  'admin-impuestos': 'impuestos',
  'admin-usuarios': 'usuarios',
  'admin-identificaciones': 'identificaciones',
  'admin-formas-pago': 'formas-pago',
  'admin-logs-inicio': 'logs-inicio',
  'admin-retenciones': 'retenciones',
  'admin-sql-auditoria': 'sql-auditoria',
};

const adminModuleConfigs: Record<string, AdminModuleConfig> = {
  'admin-cajas-secuencias': { eyebrow: 'Administracion', title: 'Cajas y secuencias', description: 'Consulta puntos de emision y ultimos secuenciales de todos los clientes.', placeholder: 'Cliente, correo, RUC, empresa, serie o SEC', action: 'Refrescar' },
  'admin-roles-permisos': { eyebrow: 'Control de accesos', title: 'Panel de seguridad', description: 'Consulta roles y perfiles registrados.', placeholder: 'Buscar perfil, modulo o permiso', action: 'Refrescar' },
  'admin-impuestos': { eyebrow: 'Listado activo', title: 'Impuestos', description: 'Consulta codigos de impuesto y porcentajes IVA.', tabs: ['Codigos de Impuesto', 'Porcentajes IVA'], placeholder: 'Buscar por codigo, descripcion o valor', action: 'Refrescar' },
  'admin-usuarios': { eyebrow: 'Administracion de accesos', title: 'Usuarios del sistema', description: 'Consulta perfiles, roles y seguridad operativa.', placeholder: 'Buscar usuario, correo o rol', action: 'Refrescar' },
  'admin-identificaciones': { eyebrow: 'Busqueda y control', title: 'Identificaciones registradas', description: 'Filtra por codigo o descripcion y consulta tus registros.', placeholder: 'Buscar por codigo o descripcion', action: 'Refrescar' },
  'admin-formas-pago': { eyebrow: 'Catalogo transaccional', title: 'Configuracion general', description: 'Consulta formas de pago y tipos de documento.', tabs: ['Formas de Pago', 'Tipos de Documento'], placeholder: 'Buscar por codigo, descripcion o SRI', action: 'Refrescar' },
  'admin-logs-inicio': { eyebrow: 'Auditoria de seguridad', title: 'Historial de accesos', description: 'Revisa inicios de sesion, eventos fallidos y actividad reciente.', tabs: ['Hoy', 'Ultimos 7 dias', 'Ultimos 30 dias'], placeholder: 'Usuario, correo, IP o estado', action: 'Refrescar' },
  'admin-retenciones': { eyebrow: 'Panel fiscal', title: 'Retenciones', description: 'Filtra por codigo o descripcion y consulta IVA, ISD y renta.', tabs: ['IVA', 'ISD', 'Renta'], placeholder: 'Buscar por codigo o descripcion', action: 'Refrescar' },
  'admin-sql-auditoria': { eyebrow: 'Bitacora', title: 'Eventos de auditoria SQL', description: 'Consulta acciones, entidades, campos y ruta/IP de auditoria.', placeholder: 'Entidad, tabla, campo, ruta o IP', action: 'Refrescar' },
};

export function isAdminMobileView(view: string) {
  return Boolean(adminModuleSlugs[view]);
}

export function getAdminModuleSlug(view: string) {
  return adminModuleSlugs[view];
}

export function getAdminModuleConfig(view: string) {
  return adminModuleConfigs[view] ?? { eyebrow: 'Administracion', title: view, description: 'Modulo administrativo preparado para movil.', placeholder: 'Buscar' };
}

export function AdminModuleScreen({
  view,
  search,
  items,
  loading,
  message,
  activeTab,
  onRefresh,
  onSearch,
  onTabChange,
  onView,
}: {
  view: string;
  search: string;
  items: AdminMobileItem[];
  loading: boolean;
  message?: MessageState;
  activeTab?: string;
  onRefresh: () => void;
  onSearch: (value: string) => void;
  onTabChange: (tab: string) => void;
  onView: (item: AdminMobileItem) => void;
}) {
  const config = getAdminModuleConfig(view);
  const selectedTab = activeTab ?? config.tabs?.[0];
  const [detailItem, setDetailItem] = useState<AdminMobileItem | null>(null);

  return (
    <>
      <View style={styles.adminHeroCard}>
        <Text style={styles.heroEyebrow}>{config.eyebrow}</Text>
        <Text style={styles.heroTitle}>{config.title}</Text>
        <Text style={styles.heroText}>{config.description}</Text>
      </View>
      {config.tabs ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminTabs}>
          {config.tabs.map((tab) => (
            <Pressable key={tab} style={[styles.adminTab, selectedTab === tab && styles.adminTabActive]} onPress={() => onTabChange(tab)}>
              <Text style={[styles.adminTabText, selectedTab === tab && styles.adminTabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.formSectionBox}>
        <View style={styles.adminSearchHeader}>
          <View style={styles.adminSearchTitleBlock}>
            <Text style={styles.clientFormSubtitle}>Busqueda y control</Text>
            <Text style={styles.clientFormTitle}>{config.title}</Text>
          </View>
          {config.action ? (
            <Pressable style={styles.adminActionPill} onPress={onRefresh}>
              <Text style={styles.adminActionText}>{config.action}</Text>
            </Pressable>
          ) : null}
        </View>
        <SearchField label={`Buscar en ${config.title}`} placeholder={config.placeholder} value={search} onChangeText={onSearch} resultCount={items.length} loading={loading} />
        {message ? <MessageBox message={message} /> : null}
        {loading ? <EmptyState title="Cargando registros" text="Consultando la informacion administrativa..." /> : null}
        {!loading && !message && items.length === 0 ? <EmptyState title="Sin registros para mostrar" text="Cuando existan registros, apareceran aqui." /> : null}
        {!loading && items.length > 0 ? (
          <ResultCollection
            items={items}
            resetKey={`${view}-${selectedTab}-${search}`}
            keyExtractor={(item, index) => `${view}-${item.id || 'item'}-${index}`}
            renderItem={(item) => (
              <AdminMobileItemCard
                item={item}
                onView={() => setDetailItem(item)}
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

function AdminMobileItemCard({ item, onView }: { item: AdminMobileItem; onView: () => void }) {
  return (
    <View style={styles.crudCard}>
      <View style={styles.clientCardHeader}>
        <View style={styles.clientAvatar}>
          <Text style={styles.clientAvatarText}>{(item.title || item.id || 'A').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.clientInfo}>
          <Text style={styles.clientName}>{item.title || item.id}</Text>
          {item.subtitle ? <Text style={styles.clientMeta}>{item.subtitle}</Text> : null}
        </View>
        {item.status ? (
          <View style={styles.systemPill}>
            <Text style={styles.systemPillText}>{item.status}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.clientDetailGrid}>
        {item.meta ? (
          <View style={styles.clientDetailItem}>
            <Text style={styles.clientDetailLabel}>Dato</Text>
            <Text style={styles.clientDetailValue}>{item.meta}</Text>
          </View>
        ) : null}
        {item.detail ? (
          <View style={styles.clientDetailItem}>
            <Text style={styles.clientDetailLabel}>Detalle</Text>
            <Text style={styles.clientDetailValue}>{item.detail}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.clientActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${item.title || item.id}`} style={[styles.smallActionButton, styles.crudViewAction]} onPress={onView}>
          <MaterialCommunityIcons name="eye-outline" size={16} color="#00649D" />
          <Text style={styles.smallActionText}>Ver</Text>
        </Pressable>
      </View>
    </View>
  );
}
