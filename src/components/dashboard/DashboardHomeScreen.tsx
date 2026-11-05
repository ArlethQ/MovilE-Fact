import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';

import type { FacturaListItem } from '../../services/facturasMobileService';
import { DashboardActivityItem, DashboardPrimaryAction } from './DashboardWidgets';
import { EFACT_THEME } from '../../styles/theme';
import { styles } from '../../styles/appStyles';
import { formatDocumentDate, formatMoney, listItemKey } from '../../utils/documentFormatting';

export type InitialSetupStatus = {
  loading: boolean;
  issuer: boolean;
  signature: boolean;
  documents: boolean;
  documentLabel: string;
};

export function DashboardHomeScreen({
  facturas,
  initialSetup,
  onOpenView,
  onOpenERubricaRequest,
  onOpenVoice,
}: {
  facturas: FacturaListItem[];
  initialSetup: InitialSetupStatus;
  onOpenView: (view: string) => void;
  onOpenERubricaRequest: () => void;
  onOpenVoice: () => void;
}) {
  const { width } = useWindowDimensions();
  const [bannerWidth, setBannerWidth] = useState(Math.max(width - 30, 1));
  const bannerHeight = Math.round(bannerWidth * 941 / 1672);
  const latestFacturas = facturas.slice(0, 3);
  const recentFactura = facturas[0];

  const completedSteps = [initialSetup.issuer, initialSetup.signature, initialSetup.documents].filter(Boolean).length;
  const setupComplete = initialSetup.loading || completedSteps === 3;
  const nextView = !initialSetup.issuer ? 'emisor' : !initialSetup.signature ? 'firma' : 'comprar-documentos';
  const nextLabel = !initialSetup.issuer ? 'Configurar emisor y punto' : !initialSetup.signature ? 'Configurar firma' : 'Comprar documentos';

  if (!setupComplete) {
    return (
      <View style={styles.dashboardHome}>
        <View style={styles.dashboardSetupPanel}>
          <View style={styles.dashboardSetupHeader}>
            <View style={styles.dashboardSetupHeaderCopy}>
              <Text style={styles.dashboardSetupEyebrow}>PRIMEROS PASOS</Text>
              <Text style={styles.dashboardSetupTitle}>Completa la configuración para empezar a emitir</Text>
              <Text style={styles.dashboardSetupIntro}>Configura los requisitos obligatorios. Clientes y productos son pasos opcionales recomendados.</Text>
            </View>
            <View style={styles.dashboardSetupProgressPill}><Text style={styles.dashboardSetupProgressValue}>{Math.round(completedSteps / 3 * 100)}%</Text><Text style={styles.dashboardSetupProgressText}>{completedSteps} de 3 requisitos</Text></View>
          </View>
          <View style={styles.dashboardSetupProgressTrack}><View style={[styles.dashboardSetupProgressBar, { width: `${completedSteps / 3 * 100}%` }]} /></View>
          <View style={styles.dashboardSetupCards}>
            <SetupCard icon="office-building-outline" title="Emisor y punto de emisión" ready={initialSetup.issuer} pending="Ingresa tus datos fiscales y configura la serie de emisión." action="Configurar" onPress={() => onOpenView('emisor')} />
            <SetupCard icon="file-certificate-outline" title="Firma electrónica" ready={initialSetup.signature} pending="Carga tu certificado .p12 o solicita una firma en E-RÚBRICA." action="Configurar" onPress={() => onOpenView('firma')} secondaryAction="Comprar E-RÚBRICA" onSecondaryPress={onOpenERubricaRequest} />
            <SetupCard icon="database-outline" title="Saldo de documentos" ready={initialSetup.documents} readyText={initialSetup.documentLabel} pending="Compra un paquete o realiza una recarga para poder emitir." action="Comprar documentos" onPress={() => onOpenView('comprar-documentos')} />
            <SetupCard icon="account-box-multiple-outline" title="Clientes y productos" ready={false} optional pending="No bloquean la emisión, pero agilizan tus siguientes comprobantes." action="Clientes" onPress={() => onOpenView('clientes')} secondaryAction="Productos" onSecondaryPress={() => onOpenView('productos')} />
          </View>
          <Pressable style={styles.dashboardSetupNextButton} onPress={() => onOpenView(nextView)}><Text style={styles.dashboardSetupNextButtonText}>{nextLabel}</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" /></Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.dashboardHome}>
      <View style={styles.dashboardNumiPanel} onLayout={({ nativeEvent }) => setBannerWidth(nativeEvent.layout.width)}>
        <Image source={require('../../../assets/numi-dashboard-banner.png')} style={[styles.dashboardNumiBanner, { height: bannerHeight }]} resizeMode="contain" />
        <Pressable accessibilityRole="button" accessibilityLabel="Generar documentos por voz con Númi" style={[styles.dashboardNumiBannerAction, styles.dashboardNumiBannerVoiceAction]} onPress={onOpenVoice} />
        <Pressable accessibilityRole="button" accessibilityLabel="Emitir factura manual" style={[styles.dashboardNumiBannerAction, styles.dashboardNumiBannerChatAction]} onPress={() => onOpenView('nueva-factura')} />
      </View>

      <View style={styles.dashboardSectionHeader}>
        <Text style={styles.dashboardSectionTitle}>Acciones principales</Text>
      </View>
      <View style={styles.dashboardActionRow}>
        <DashboardPrimaryAction icon="file-plus-outline" label="Nueva factura" text="Emitir comprobante" primary onPress={() => onOpenView('nueva-factura')} />
        <DashboardPrimaryAction icon="account-plus-outline" label="Nuevo cliente" text="Registrar datos" onPress={() => onOpenView('nuevo-cliente')} />
        <DashboardPrimaryAction icon="robot-outline" label="Númi" text="Asistente" onPress={() => onOpenView('bot')} />
        <DashboardPrimaryAction icon="file-document-outline" label="Mis facturas" text="Consultar emitidas" onPress={() => onOpenView('mis-facturas')} />
        <DashboardPrimaryAction icon="package-variant-closed" label="Productos" text="Catalogo" onPress={() => onOpenView('productos')} />
        <DashboardPrimaryAction icon="store-cog-outline" label="Series" text="Cajas" onPress={() => onOpenView('punto-emision')} />
      </View>

      <View style={styles.dashboardActivityPanel}>
        <View style={styles.dashboardSectionHeader}>
          <Text style={styles.dashboardSectionTitle}>Actividad reciente</Text>
          <Pressable hitSlop={8} onPress={() => onOpenView('mis-facturas')}>
            <Text style={styles.dashboardViewAll}>Ver facturas</Text>
          </Pressable>
        </View>
        {latestFacturas.length ? latestFacturas.map((factura, index) => (
          <DashboardActivityItem
            key={listItemKey('dashboard-factura', [factura.codfactura, factura.numeroCompleto, factura.numfactura], index)}
            color={EFACT_THEME.colors.secondary}
            title={factura.numeroCompleto ?? factura.numfactura ?? 'Factura emitida'}
            subtitle={`${factura.cliente ?? 'Cliente'} · ${formatDocumentDate(factura.fechaEmision)}`}
            amount={formatMoney(factura.total)}
            status={factura.autorizado || String(factura.estadoSri ?? '').toUpperCase().includes('AUTORIZ') ? 'Autorizada' : factura.estadoSri ?? 'Pendiente'}
          />
        )) : (
          <DashboardActivityItem
            color={EFACT_THEME.colors.info}
            title={recentFactura?.numeroCompleto ?? 'Sin documentos recientes'}
            subtitle="Cuando emitas comprobantes aparecerán aquí."
            status="Borrador"
          />
        )}
      </View>

    </View>
  );
}

function SetupCard({ icon, title, ready, readyText = 'Configurado', pending, optional = false, action, onPress, secondaryAction, onSecondaryPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; title: string; ready: boolean; readyText?: string; pending: string; optional?: boolean; action: string; onPress: () => void; secondaryAction?: string; onSecondaryPress?: () => void }) {
  return <View style={[styles.dashboardSetupCard, ready && styles.dashboardSetupCardReady]}><View style={[styles.dashboardSetupCardIcon, ready && styles.dashboardSetupCardIconReady]}><MaterialCommunityIcons name={ready ? 'check-circle-outline' : icon} size={23} color={ready ? '#0B9661' : EFACT_THEME.colors.primary} /></View><View style={styles.dashboardSetupCardCopy}><View style={styles.dashboardSetupCardTitleRow}><Text style={styles.dashboardSetupCardTitle}>{title}</Text>{optional ? <Text style={styles.dashboardSetupOptional}>RECOMENDADO</Text> : null}</View><Text style={[styles.dashboardSetupCardState, ready && styles.dashboardSetupCardStateReady]}>{ready ? readyText : optional ? 'Opcional' : 'Pendiente'}</Text><Text style={styles.dashboardSetupCardText}>{ready ? 'Este requisito ya está listo.' : pending}</Text>{!ready ? <View style={styles.dashboardSetupCardActions}><Pressable style={styles.dashboardSetupCardButton} onPress={onPress}><Text style={styles.dashboardSetupCardButtonText}>{action}</Text></Pressable>{secondaryAction && onSecondaryPress ? <Pressable style={styles.dashboardSetupCardButtonSecondary} onPress={onSecondaryPress}><Text style={styles.dashboardSetupCardButtonText}>{secondaryAction}</Text></Pressable> : null}</View> : null}</View></View>;
}
