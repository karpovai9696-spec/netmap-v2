import { ROOMS, BUILDING } from './correctPlan';

/**
 * Сетевые данные из документа «Офисный VPN-шлюз (srv-diamedika, 192.168.1.227)»
 * и логические объекты для отображения на плане.
 */

const roomPoint = (premise: string, num: string, dx = 0, dy = 0): [number, number] => {
  const room = ROOMS.find((r) => r.premise === premise && r.num === String(num));
  if (!room) return [18, 9];
  return [room.centroid[0] + dx, room.centroid[1] + dy];
};

export const OFFICE_NET = {
  title: 'Сеть офиса и VPN-шлюз',
  subtitle: 'по документации OFFICE-GATEWAY.md v2.0 (27.10.2026) · объект: Козина 7, пом. 1080 + 1079',
  purpose:
    'Выборочный обход блокировок для всего офиса без VPN-клиентов на устройствах. В туннель уходят только Telegram, Meta (Instagram/Facebook/WhatsApp), YouTube/Google, Recraft и Miro. Остальной трафик идёт напрямую через провайдера ТТК — падение VPN не прерывает работу офиса.',

  chain: [
    { step: 'ОФИС', label: 'Устройства 192.168.1.0/24', detail: 'ПК, телефоны, камеры, Wi-Fi; DNS 192.168.1.1' },
    { step: 'ШЛЮЗ', label: 'Keenetic Viva', detail: '192.168.1.1 · KeeneticOS 2.16.D.12' },
    {
      step: 'VPN-СЕРВЕР',
      label: 'srv-diamedika',
      detail: '192.168.1.227 · hysteria, coredns, tls-proxy, sni-proxy, kn-watchdog',
    },
    { step: 'ТУННЕЛЬ', label: 'Hysteria2 + obfs salamander', detail: 'UDP 8443 · TUN «vpngw» 172.19.77.1/30' },
    { step: 'VPS', label: 'ihor, Хельсинки', detail: '178.253.16.59 · выход в интернет' },
  ],

  hosts: [
    { name: 'Офисная сеть', ip: '192.168.1.0/24', role: 'Плоская LAN, DNS 192.168.1.1', place: 'офис' },
    { name: 'Keenetic Viva', ip: '192.168.1.1', role: 'Роутер, шлюз, DNS, статические маршруты в туннель', place: 'офис' },
    {
      name: 'srv-diamedika',
      ip: '192.168.1.227 · .228',
      role: 'VPN-шлюз: hysteria, coredns (:53), tls-proxy (:443), sni-proxy (.228:443), портал (.250)',
      place: 'серверная',
    },
    { name: 'server-kk', ip: '192.168.1.169', role: 'Старый сервер; проброс 7400 (сейчас не слушает)', place: 'архив' },
    { name: 'Wi-Fi портал', ip: '192.168.1.250', role: 'Регистрация устройств гостевого Wi-Fi', place: 'офис' },
    { name: 'VPS ihor', ip: '178.253.16.59', role: 'Hysteria2, nginx + LE-сертификат a.mdlp.gk-kd.ru, SSH reverse-туннель 24110', place: 'Хельсинки' },
  ],

  services: [
    { port: '53/tcp+udp', service: 'coredns', purpose: 'DNS-разводилка: блокировки → 8.8.8.8, recraft/miro → .228, a.mdlp → .227' },
    { port: '443/tcp', service: 'tls-proxy', purpose: 'SNI-диспетчер: a.mdlp.gk-kd.ru → TLS-терминация → :24110; остальное → :7443 портал' },
    { port: '443/tcp', service: 'sni-proxy (.228)', purpose: 'Region-blocked: Recraft/Miro в туннель, чужие SNI — drop' },
    { port: '8443/udp', service: 'hysteria', purpose: 'Туннель до VPS 178.253.16.59 (Hysteria2, obfs salamander)' },
    { port: '7400/tcp', service: 'tls-proxy → .169', purpose: 'Сквозной TCP на старый сервер (устаревший путь)' },
    { port: '24110/tcp', service: 'агрегатор МДЛП', purpose: 'Docker-стек на 227 (nginx, внутренний KK CA); снаружи — через VPS' },
    { port: '25645/tcp', service: 'проброс Keenetic', purpose: 'Проброс на 227 (контролируется kn-watchdog)' },
    { port: '15 мин', service: 'kn-watchdog', purpose: 'Чинит Keenetic: маршруты, пробросы, DNS-форвардинг, сертификат; алерты в Telegram' },
  ],

  dns: [
    'Заблокированные домены (telegram/meta/youtube/googleapis/gstatic — 19 зон) → 8.8.8.8 / 1.1.1.1; их /32-маршруты ведут в туннель.',
    'recraft.ai → A = 192.168.1.228 (SNI-прокси), AAAA = NODATA.',
    'miro.com → A = 192.168.1.228 (в туннель), AAAA = NODATA.',
    'a.mdlp.gk-kd.ru → A = 192.168.1.227 (локальный tls-proxy с валидным LE-сертификатом).',
    'Всё остальное → DNS провайдера ТТК (192.168.2.1) — резиленс при падении VPN.',
  ],

  tunnel: ['Telegram', 'Meta: Instagram / Facebook / WhatsApp', 'YouTube / Google', 'api.recraft.ai · t.recraft.ai', 'miro.com'],
  direct: ['MAX и российские сервисы — намеренно напрямую', 'Всё, чего нет в списках', 'QUIC/HTTP3 заблокирован (REJECT udp/443) → браузеры уходят на TCP'],

  diagnostics: [
    'systemctl is-active hysteria coredns tls-proxy sni-proxy',
    "curl -s -o /dev/null -w '%{http_code}\\n' --interface vpngw https://gemini.google.com/app   # 200 = туннель жив",
    'tail -5 /opt/vpn-gw/sni-proxy.log        # tunnel / direct / drop',
    'iptables -L FORWARD -n -v | head -8      # QUIC-REJECT на месте',
    'tail -5 /opt/vpn-gw/kn-watchdog.log      # OK / RESTORED / cert OK / tunnel OK',
  ],

  notes: [
    'Keenetic не шлёт весь DNS на .227: у авто-DNS провайдера приоритет выше. Для recraft.ai, a.mdlp.gk-kd.ru и miro.com настроен доменный форвардинг — его восстанавливает kn-watchdog.',
    'kn-watchdog содержит пароль роутера — файл нельзя публиковать в GitHub.',
    'Агрегатор МДЛП публично доступен из интернета через VPS; следить, чтобы авторизация была включена.',
    'Сертификат a.mdlp.gk-kd.ru синхронизируется с VPS ежедневно в 05:17; watchdog сверяет серийники.',
    'Проброс Keenetic 24110 → .169 устарел: агрегатор переехал на 227.',
  ],
};

// ------------------------- объекты для плана --------------------------------
export const NET_LAYER = {
  id: 'vpn',
  name: 'VPN / шлюз',
  color: '#A78BFA',
  visible: true,
  locked: false,
  lineStyle: 'dashed' as const,
};

export const NET_CABLE_TYPE = {
  id: 'vpn',
  name: 'VPN-туннель (Hysteria2)',
  short: 'VPN tunnel',
  color: '#A78BFA',
  dashed: true,
  layer: 'vpn',
  pricePerM: 0,
};

const [sx, sy] = roomPoint('1079', '14', 0, 0);

export const NET_PLAN_NODES = [
  {
    id: 'NET-GW-1',
    type: 'router',
    name: 'Keenetic Viva — шлюз офиса',
    code: 'GW-KEEN',
    layer: 'vpn',
    x: round(sx - 2.3),
    y: round(sy - 1.6),
    ip: '192.168.1.1',
    vlan: 'LAN / WAN',
    model: 'Keenetic Viva (KeeneticOS 2.16.D.12)',
    port: 'WAN → ТТК',
    heightM: 1.5,
    notes:
      'DNS + маршруты в туннель: 39 префиксов + 8.8.8.8/32, 1.1.1.1/32 → 192.168.1.227. Доменный форвардинг recraft.ai / miro.com / a.mdlp.gk-kd.ru.',
  },
  {
    id: 'NET-VPN-1',
    type: 'server',
    name: 'srv-diamedika — VPN-шлюз',
    code: 'VPN-GW',
    layer: 'vpn',
    x: round(sx + 2.6),
    y: round(sy + 1.7),
    ip: '192.168.1.227',
    vlan: 'LAN / TUN',
    model: 'Ubuntu · hysteria + coredns + tls-proxy + sni-proxy + kn-watchdog',
    port: 'UDP 8443 → VPS',
    heightM: 1.6,
    notes:
      'DNS :53, TLS :443, SNI-прокси 192.168.1.228:443, Wi-Fi портал 192.168.1.250, агрегатор МДЛП :24110. Hysteria2 + obfs salamander, TUN vpngw.',
  },
  {
    id: 'NET-VPS-1',
    type: 'server',
    name: 'VPS ihor (Хельсинки) — внешний узел',
    code: 'VPS-FI',
    layer: 'vpn',
    x: round(BUILDING.width + 2.6),
    y: 6.2,
    ip: '178.253.16.59',
    vlan: '— внешний',
    model: 'Hysteria2 + nginx, LE-сертификат',
    port: 'UDP 8443 / TCP 443',
    heightM: 0,
    notes: 'Логически внешний узел за туннелем; выход в интернет с финским IP. SSH reverse-туннель 24110 для агрегатора МДЛП.',
  },
];

export const NET_PLAN_CABLES = [
  { id: 'NET-C-GW-VPN', from: 'NET-GW-1', to: 'NET-VPN-1', cableType: 'utp6', routeMode: 'ortho-hv', label: 'LAN' },
  { id: 'NET-C-VPN-VPS', from: 'NET-VPN-1', to: 'NET-VPS-1', cableType: 'vpn', routeMode: 'direct', label: 'Tunnel UDP 8443' },
  { id: 'NET-C-GW-SW', from: 'NET-GW-1', to: 'N-SW-1', cableType: 'utp6', routeMode: 'ortho-hv', label: 'Uplink' },
];

export const NET_NOTES = [
  {
    id: 'NET-NOTE-1',
    x: round(sx - 3.6),
    y: round(sy - 3.2),
    text: 'VPN-шлюз: Keenetic .1 → srv-diamedika .227 → VPS 178.253.16.59',
    layer: 'notes',
  },
];

function round(v: number) {
  return Math.round(v * 100) / 100;
}
