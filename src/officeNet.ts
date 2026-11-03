/**
 * Слой и тип кабеля для сетевой документации.
 * Сами данные документации (адреса, сервисы, объекты) лежат на сервере
 * (`server/docs.json`) и доступны только авторизованным пользователям —
 * чтобы не публиковать карту сети в открытом GitHub Pages.
 */

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
