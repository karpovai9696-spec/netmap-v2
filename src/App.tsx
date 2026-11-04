import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Network,
  MousePointer,
  Hand,
  Cpu,
  Cable,
  BrickWall,
  Ruler,
  Type,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Wifi,
  Sun,
  Moon,
  Search,
  Sliders,
  Layers,
  FileSpreadsheet,
  Check,
  ChevronDown,
  ChevronRight,
  Server,
  Router,
  Monitor,
  Phone,
  Camera,
  Zap,
  HardDrive,
  Printer,
  ShieldAlert,
  Info,
  Sparkles,
  Move,
  CornerDownRight,
  X,
  FolderOpen,
  FileText,
  RotateCw,
  BookOpen
} from 'lucide-react';

import {
  ROOMS as PLAN_ROOMS,
  WALLS as PLAN_WALLS,
  EXTERIOR_ENTRIES as PLAN_EXTERIOR,
  WINDOWS as PLAN_WINDOWS,
  BUILDING,
} from './correctPlan';
import { OfficeDocs } from './OfficeDocs';
import planDrawingUrl from './assets/plan-drawing.svg?url';
import { NET_LAYER, NET_CABLE_TYPE } from './officeNet';
import { useCollab, diffOps } from './collab';
import type { User, Op, SharedProject } from './collab';
import { LoginScreen, OnlineBadge, PasswordDialog, ActivityFeed, RemoteCursors } from './Live';
import type { ActivityItem } from './Live';

// ============================================================================
// КОНСТАНТЫ МАСШТАБА И ЕДИНОЙ ГЕОМЕТРИИ ЗДАНИЯ (КОЗИНА 7, ПОМ. 1080 + 1079)
// Масштаб: 1 метр = 32 пикселя на векторном холсте
// Общие габариты здания: 32.46 м (ширина) x 16.21 м (глубина)
// ============================================================================
const STORAGE_KEY = 'netmap-v2.project.v1';

const loadSavedProject = (): any | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const SAVED = loadSavedProject();

const SCALE = 32; // 1m = 32px
const CEILING_HEIGHT = 3.96; // h = 3.96м по паспорту БТИ

// ============================================================================
// ГЕОМЕТРИЯ ЗДАНИЯ — ТОЛЬКО ПРОВЕРЕННАЯ МОДЕЛЬ (out/*.csv)
// Метры; единая система координат: пом. 1080 слева + пом. 1079 справа.
// ============================================================================
const INITIAL_ROOMS = PLAN_ROOMS;
const INITIAL_WALLS = PLAN_WALLS;
const EXTERIOR_ENTRIES = PLAN_EXTERIOR;

// Демо-объекты Gemini были заданы в старой системе 32.46 x 16.21 м — приводим к реальной геометрии
const LEGACY_W = 32.46;
const LEGACY_H = 16.21;
const SX = BUILDING.width / LEGACY_W;
const SY = BUILDING.depth / LEGACY_H;
const inMeters = (v: number, k: number) => Math.round(v * k * 100) / 100;
const TOTAL_AREA = INITIAL_ROOMS.reduce((s, r) => s + (r.area || 0), 0);

// Центр вращения плана (180°) в координатах холста
const ROT_CX = Math.round((BUILDING.width / 2) * SCALE);
const ROT_CY = Math.round((BUILDING.minY + BUILDING.height / 2) * SCALE);

// Слои проекта (объединяют управление видимостью, блокировкой и цветовую легенду)
const INITIAL_LAYERS = [
  { id: 'scs', name: 'Интернет / СКС', color: '#FCD116', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'telephony', name: 'Телефония (SIP)', color: '#34D399', visible: true, locked: false, lineStyle: 'dashed' },
  { id: 'pc', name: 'ПК и рабочие места', color: '#A78BFA', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'servers', name: 'Серверы и ядро сети', color: '#FB923C', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'cctv', name: 'Видеонаблюдение', color: '#FB7185', visible: true, locked: false, lineStyle: 'dashed' },
  { id: 'power', name: 'Электрика и питание 220В', color: '#EF4444', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'partitions', name: 'Перегородки (редакт.)', color: '#6B6552', visible: true, locked: false, lineStyle: 'solid' },
  { id: 'notes', name: 'Пометки и размеры', color: '#8F8A6E', visible: true, locked: false, lineStyle: 'dotted' },
  NET_LAYER,
];

// Каталог оборудования для левой панели
const EQUIPMENT_CATALOG = [
  {
    group: 'СЕТЬ И СКС',
    items: [
      { type: 'router', name: 'Роутер / МСЭ', short: 'GW', layer: 'scs', model: 'MikroTik CCR2004', icon: 'Router', ports: 12 },
      { type: 'switch', name: 'Коммутатор PoE', short: 'SW', layer: 'scs', model: 'UniFi Pro 48 PoE', icon: 'Network', ports: 48 },
      { type: 'wifi', name: 'Wi-Fi точка (AP)', short: 'AP', layer: 'scs', model: 'UniFi U6 Pro', icon: 'Wifi', radius: 7.5 },
      { type: 'patch', name: 'Патч-панель / Шкаф', short: 'RACK', layer: 'servers', model: 'Шкаф 19" 42U', icon: 'Server', ports: 48 },
      { type: 'rj45', name: 'Розетка RJ-45 (2x)', short: 'RJ45', layer: 'scs', model: 'Legrand Cat.6', icon: 'Cpu', ports: 2 },
    ]
  },
  {
    group: 'СЕРВЕРЫ И АРМ',
    items: [
      { type: 'server', name: 'Сервер / СХД', short: 'SRV', layer: 'servers', model: 'Dell PowerEdge R750', icon: 'HardDrive' },
      { type: 'pc', name: 'Рабочее место (ПК)', short: 'ПК', layer: 'pc', model: 'АРМ Стандарт', icon: 'Monitor' },
      { type: 'printer', name: 'МФУ / Принтер', short: 'МФУ', layer: 'pc', model: 'Kyocera TASKalfa', icon: 'Printer' },
      { type: 'phone', name: 'IP-телефон (SIP)', short: 'TEL', layer: 'telephony', model: 'Yealink SIP-T54W', icon: 'Phone' },
    ]
  },
  {
    group: 'БЕЗОПАСНОСТЬ И ПИТАНИЕ',
    items: [
      { type: 'camera', name: 'IP-камера PoE', short: 'CAM', layer: 'cctv', model: 'Hikvision 4MP Dome', icon: 'Camera' },
      { type: 'nvr', name: 'Видеорегистратор', short: 'NVR', layer: 'cctv', model: 'Hikvision DS-7732NI', icon: 'HardDrive' },
      { type: 'ups', name: 'ИБП (UPS) / Щит', short: 'ЩР/UPS', layer: 'power', model: 'APC Smart-UPS 3000', icon: 'Zap' },
    ]
  }
];

// Типы кабелей для прокладки
const CABLE_TYPES = [
  { id: 'utp6', name: 'СКС / Витая пара UTP Cat.6', short: 'UTP Cat.6', color: '#FCD116', dashed: false, layer: 'scs', pricePerM: 48 },
  { id: 'fiber', name: 'Оптика SM/MM (магистраль)', short: 'Оптика OM4', color: '#F59E0B', dashed: false, layer: 'servers', pricePerM: 95 },
  { id: 'phone_cab', name: 'Телефония / SIP линия', short: 'UTP Cat.5e (Tel)', color: '#34D399', dashed: true, layer: 'telephony', pricePerM: 35 },
  { id: 'cctv_poe', name: 'Видеонаблюдение PoE', short: 'UTP Cat.6 PoE', color: '#FB7185', dashed: true, layer: 'cctv', pricePerM: 52 },
  { id: 'power_220', name: 'Питание 220В (ВВГнг-LS)', short: 'ВВГнг 3х2.5', color: '#EF4444', dashed: false, layer: 'power', pricePerM: 110 },
  NET_CABLE_TYPE,
];

// Стартовая демонстрационная схема сети (повторяет логику со скриншота пользователя, развернутую на оба помещения)
const INITIAL_NODES = [
  // Ядро сети (Серверная №14 и Кроссовая №11 в 1080)
  { id: 'N-RACK-1', type: 'patch', name: 'Шкаф ЦОД 19" (ГК)', code: 'RACK-1', layer: 'servers', x: 19.2, y: 9.7, ip: '192.168.1.1', vlan: 'MGMT (1)', model: 'Шкаф 19" 42U + Патч-панель', port: 'Core', heightM: 0.0, notes: 'Главный кросс здания' },
  { id: 'N-GW-1', type: 'router', name: 'Роутер / МСЭ', code: 'GW-1', layer: 'scs', x: 17.5, y: 6.2, ip: '192.168.1.254', vlan: 'WAN / ALL', model: 'MikroTik CCR2004-1G-12S+', port: 'SFP+1', heightM: 1.5, notes: 'Оптический ввод 2 провайдера' },
  { id: 'N-SW-1', type: 'switch', name: 'Коммутатор Ядра PoE', code: 'SW-Core', layer: 'scs', x: 19.2, y: 6.2, ip: '192.168.1.2', vlan: 'TRUNK', model: 'UniFi Pro 48 PoE (600W)', port: 'SFP+2', heightM: 1.5, notes: 'Питание точек Wi-Fi и камер' },
  { id: 'N-SW-2', type: 'switch', name: 'Кросс пом. 1080', code: 'SW-1080', layer: 'scs', x: 8.6, y: 7.9, ip: '192.168.1.3', vlan: 'TRUNK', model: 'UniFi Pro 24 PoE', port: 'Gi1/0/24', heightM: 1.8, notes: 'Настенный шкаф 9U в пом. 11' },
  { id: 'N-NVR-1', type: 'nvr', name: 'Видеорегистратор', code: 'NVR-1', layer: 'cctv', x: 20.8, y: 9.7, ip: '192.168.50.10', vlan: 'CCTV (50)', model: 'Hikvision DS-7732NI-I4', port: 'Gi1/0/45', heightM: 1.2, notes: 'Архив 32 ТБ (RAID5)' },

  // Точки доступа Wi-Fi (с радиусом покрытия)
  { id: 'N-AP-1', type: 'wifi', name: 'Wi-Fi Зал 1080 (Сев)', code: 'AP-1', layer: 'scs', x: 3.8, y: 2.5, ip: '192.168.1.11', vlan: 'WIFI (20)', model: 'UniFi U6 Pro', port: 'SW2:PoE1', heightM: 3.8, radius: 7.5, notes: 'Потолочный монтаж h=3.8м' },
  { id: 'N-AP-2', type: 'wifi', name: 'Wi-Fi Зал 1080 (Юг)', code: 'AP-2', layer: 'scs', x: 3.8, y: 11.2, ip: '192.168.1.12', vlan: 'WIFI (20)', model: 'UniFi U6 Pro', port: 'SW2:PoE2', heightM: 3.8, radius: 7.5, notes: 'Потолочный монтаж h=3.8м' },
  { id: 'N-AP-3', type: 'wifi', name: 'Wi-Fi Холл 12', code: 'AP-3', layer: 'scs', x: 14.5, y: 5.5, ip: '192.168.1.13', vlan: 'WIFI (20)', model: 'UniFi U6 Pro', port: 'SW1:PoE3', heightM: 3.5, radius: 7.0, notes: 'Зона ожидания' },
  { id: 'N-AP-4', type: 'wifi', name: 'Wi-Fi Офисы 1079', code: 'AP-4', layer: 'scs', x: 25.5, y: 7.8, ip: '192.168.1.14', vlan: 'WIFI (20)', model: 'UniFi U6 Long-Range', port: 'SW1:PoE4', heightM: 3.5, radius: 8.5, notes: 'Покрытие коридора 13 и правого крыла' },

  // Рабочие места (ПК и МФУ)
  { id: 'N-PC-1', type: 'pc', name: 'АРМ Ресепшн 1080', code: 'ПК-1', layer: 'pc', x: 11.0, y: 2.3, ip: '192.168.10.21', vlan: 'LAN (10)', model: 'Core i5 / 16GB', port: 'SW2:P5', heightM: 0.75, notes: 'Стойка администратора' },
  { id: 'N-PC-2', type: 'pc', name: 'АРМ Кабинет №2', code: 'ПК-2', layer: 'pc', x: 16.4, y: 2.9, ip: '192.168.10.22', vlan: 'LAN (10)', model: 'Core i5 / 16GB', port: 'SW1:P10', heightM: 0.75, notes: 'Бухгалтерия' },
  { id: 'N-PC-3', type: 'pc', name: 'АРМ Кабинет №3', code: 'ПК-3', layer: 'pc', x: 19.7, y: 2.8, ip: '192.168.10.23', vlan: 'LAN (10)', model: 'Core i7 / 32GB', port: 'SW1:P11', heightM: 0.75, notes: 'Руководитель' },
  { id: 'N-PC-4', type: 'pc', name: 'АРМ Отдел продаж', code: 'ПК-4', layer: 'pc', x: 26.2, y: 2.5, ip: '192.168.10.24', vlan: 'LAN (10)', model: 'Core i5 / 16GB', port: 'SW1:P12', heightM: 0.75, notes: 'Менеджер' },
  { id: 'N-PC-5', type: 'pc', name: 'АРМ ИТ-отдел №16', code: 'ПК-5', layer: 'pc', x: 23.8, y: 11.2, ip: '192.168.10.25', vlan: 'IT (99)', model: 'Workstation', port: 'SW1:P15', heightM: 0.75, notes: 'Системный администратор' },
  { id: 'N-PRN-1', type: 'printer', name: 'Сетевое МФУ Kyocera', code: 'МФУ-1', layer: 'pc', x: 21.6, y: 6.2, ip: '192.168.10.200', vlan: 'LAN (10)', model: 'Kyocera TASKalfa 2554ci', port: 'SW1:P20', heightM: 0.9, notes: 'Общий принтер этажа' },

  // IP-телефония
  { id: 'N-TEL-1', type: 'phone', name: 'Телефон Ресепшн', code: 'TEL-101', layer: 'telephony', x: 12.6, y: 2.3, ip: '192.168.30.101', vlan: 'VOICE (30)', model: 'Yealink T54W', port: 'SW2:P9', heightM: 0.8, notes: 'Внутр. 101' },
  { id: 'N-TEL-2', type: 'phone', name: 'Телефон Каб. №2', code: 'TEL-102', layer: 'telephony', x: 15.6, y: 3.8, ip: '192.168.30.102', vlan: 'VOICE (30)', model: 'Yealink T33G', port: 'SW1:P21', heightM: 0.8, notes: 'Внутр. 102' },
  { id: 'N-TEL-3', type: 'phone', name: 'Телефон Каб. №4', code: 'TEL-104', layer: 'telephony', x: 22.8, y: 2.8, ip: '192.168.30.104', vlan: 'VOICE (30)', model: 'Yealink T33G', port: 'SW1:P22', heightM: 0.8, notes: 'Внутр. 104' },
  { id: 'N-TEL-4', type: 'phone', name: 'Телефон Зал №6', code: 'TEL-106', layer: 'telephony', x: 30.8, y: 5.5, ip: '192.168.30.106', vlan: 'VOICE (30)', model: 'Yealink T33G', port: 'SW1:P23', heightM: 0.8, notes: 'Внутр. 106' },

  // Видеонаблюдение (IP-камеры)
  { id: 'N-CAM-1', type: 'camera', name: 'Камера Вход / Пандус', code: 'CAM-1', layer: 'cctv', x: 11.2, y: 0.5, ip: '192.168.50.101', vlan: 'CCTV (50)', model: 'Hikvision 4MP Bullet', port: 'SW2:PoE11', heightM: 3.5, notes: 'Контроль входа 1080' },
  { id: 'N-CAM-2', type: 'camera', name: 'Камера Зал 164 м²', code: 'CAM-2', layer: 'cctv', x: 0.8, y: 1.0, ip: '192.168.50.102', vlan: 'CCTV (50)', model: 'Hikvision 4MP Dome', port: 'SW2:PoE12', heightM: 3.8, notes: 'Обзор главного зала' },
  { id: 'N-CAM-3', type: 'camera', name: 'Камера Крыльцо 1079', code: 'CAM-3', layer: 'cctv', x: 16.5, y: 0.4, ip: '192.168.50.103', vlan: 'CCTV (50)', model: 'Hikvision 4MP Dome', port: 'SW1:PoE31', heightM: 3.2, notes: 'Контроль тамбура №1' },
  { id: 'N-CAM-4', type: 'camera', name: 'Камера Вост. вход', code: 'CAM-4', layer: 'cctv', x: 31.6, y: 0.6, ip: '192.168.50.104', vlan: 'CCTV (50)', model: 'Hikvision 4MP Dome', port: 'SW1:PoE32', heightM: 3.2, notes: 'Вход пом. 6' },

  // Электрика и щиты
  { id: 'N-PWR-1', type: 'ups', name: 'ИБП Серверной 3000VA', code: 'UPS-1', layer: 'power', x: 21.0, y: 12.4, ip: '192.168.1.20', vlan: 'MGMT (1)', model: 'APC Smart-UPS 3000VA', port: 'ЩР-Гл', heightM: 0.5, notes: 'Питание стойки RACK-1' },
  { id: 'N-PWR-2', type: 'ups', name: 'Щит силовой ЩР-1080', code: 'ЩР-1', layer: 'power', x: 9.8, y: 7.9, ip: '—', vlan: '220V', model: 'Щит ABB 54 мод.', port: 'ВРУ', heightM: 1.6, notes: 'Питание зала 1080 и кросса' },
];

// Привязка демонстрационного оборудования к помещениям проверенной модели
const DEMO_ROOM: Record<string, [string, string, number, number]> = {
  'N-RACK-1': ['1079', '14', -0.3, 0.1],
  'N-GW-1': ['1079', '12', 0.6, -0.5],
  'N-SW-1': ['1079', '13', -0.5, 0.1],
  'N-SW-2': ['1080', '11', 0.0, 0.0],
  'N-NVR-1': ['1079', '14', 0.5, 0.6],
  'N-AP-1': ['1080', '12', -2.6, -2.2],
  'N-AP-2': ['1080', '12', -2.6, 2.6],
  'N-AP-3': ['1079', '12', 1.6, 0.9],
  'N-AP-4': ['1079', '5', 0.2, 0.2],
  'N-PC-1': ['1080', '12', -4.2, -0.4],
  'N-PC-2': ['1079', '2', 0.0, 0.3],
  'N-PC-3': ['1079', '3', 0.0, 0.2],
  'N-PC-4': ['1079', '5', 0.8, 0.6],
  'N-PC-5': ['1079', '16', 0.0, 0.0],
  'N-PRN-1': ['1079', '13', -1.8, 0.1],
  'N-TEL-1': ['1080', '12', -5.6, -1.2],
  'N-TEL-2': ['1079', '2', 0.7, 0.5],
  'N-TEL-3': ['1079', '4', 0.2, 0.3],
  'N-TEL-4': ['1079', '6', 0.4, 0.4],
  'N-CAM-1': ['1080', '8', 0.0, 0.0],
  'N-CAM-2': ['1080', '12', -6.2, -3.2],
  'N-CAM-3': ['1079', '30', 0.0, 0.0],
  'N-CAM-4': ['1079', '6', 0.8, -2.2],
  'N-PWR-1': ['1079', '15', 0.0, 0.0],
  'N-PWR-2': ['1080', '11', 0.4, -0.4],
};

const roomPoint = (premise: string, num: string, dx = 0, dy = 0): [number, number] => {
  const room = INITIAL_ROOMS.find((r) => r.premise === premise && r.num === String(num));
  if (!room) return [BUILDING.width / 2, BUILDING.depth / 2];
  return [room.centroid[0] + dx, room.centroid[1] + dy];
};

const DEMO_NODES = INITIAL_NODES.map((n) => {
  const m = DEMO_ROOM[n.id];
  if (!m) return n;
  const [x, y] = roomPoint(m[0], m[1], m[2], m[3]);
  return { ...n, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
});

// Стартовые кабельные трассы (соединяют узлы ортогональными линиями)
const INITIAL_CABLES = [
  // Магистрали и ядро
  { id: 'C-01', from: 'N-RACK-1', to: 'N-SW-1', cableType: 'fiber', routeMode: 'ortho-vh' },
  { id: 'C-02', from: 'N-GW-1', to: 'N-SW-1', cableType: 'utp6', routeMode: 'ortho-hv' },
  { id: 'C-03', from: 'N-SW-1', to: 'N-SW-2', cableType: 'fiber', routeMode: 'ortho-hv' },
  { id: 'C-04', from: 'N-RACK-1', to: 'N-NVR-1', cableType: 'utp6', routeMode: 'ortho-hv' },

  // Точки доступа Wi-Fi
  { id: 'C-05', from: 'N-SW-2', to: 'N-AP-1', cableType: 'utp6', routeMode: 'ortho-hv' },
  { id: 'C-06', from: 'N-SW-2', to: 'N-AP-2', cableType: 'utp6', routeMode: 'ortho-hv' },
  { id: 'C-07', from: 'N-SW-1', to: 'N-AP-3', cableType: 'utp6', routeMode: 'ortho-hv' },
  { id: 'C-08', from: 'N-SW-1', to: 'N-AP-4', cableType: 'utp6', routeMode: 'ortho-vh' },

  // ПК и принтеры
  { id: 'C-09', from: 'N-SW-2', to: 'N-PC-1', cableType: 'utp6', routeMode: 'ortho-vh' },
  { id: 'C-10', from: 'N-SW-1', to: 'N-PC-2', cableType: 'utp6', routeMode: 'ortho-hv' },
  { id: 'C-11', from: 'N-SW-1', to: 'N-PC-3', cableType: 'utp6', routeMode: 'ortho-vh' },
  { id: 'C-12', from: 'N-SW-1', to: 'N-PC-4', cableType: 'utp6', routeMode: 'ortho-hv' },
  { id: 'C-13', from: 'N-RACK-1', to: 'N-PC-5', cableType: 'utp6', routeMode: 'ortho-vh' },
  { id: 'C-14', from: 'N-SW-1', to: 'N-PRN-1', cableType: 'utp6', routeMode: 'ortho-hv' },

  // Телефония
  { id: 'C-15', from: 'N-SW-2', to: 'N-TEL-1', cableType: 'phone_cab', routeMode: 'ortho-vh' },
  { id: 'C-16', from: 'N-SW-1', to: 'N-TEL-2', cableType: 'phone_cab', routeMode: 'ortho-hv' },
  { id: 'C-17', from: 'N-SW-1', to: 'N-TEL-3', cableType: 'phone_cab', routeMode: 'ortho-hv' },
  { id: 'C-18', from: 'N-SW-1', to: 'N-TEL-4', cableType: 'phone_cab', routeMode: 'ortho-hv' },

  // Камеры видеонаблюдения
  { id: 'C-19', from: 'N-SW-2', to: 'N-CAM-1', cableType: 'cctv_poe', routeMode: 'ortho-vh' },
  { id: 'C-20', from: 'N-SW-2', to: 'N-CAM-2', cableType: 'cctv_poe', routeMode: 'ortho-hv' },
  { id: 'C-21', from: 'N-NVR-1', to: 'N-CAM-3', cableType: 'cctv_poe', routeMode: 'ortho-vh' },
  { id: 'C-22', from: 'N-NVR-1', to: 'N-CAM-4', cableType: 'cctv_poe', routeMode: 'ortho-hv' },

  // Линии питания 220В
  { id: 'C-23', from: 'N-PWR-1', to: 'N-RACK-1', cableType: 'power_220', routeMode: 'ortho-vh' },
  { id: 'C-24', from: 'N-PWR-2', to: 'N-SW-2', cableType: 'power_220', routeMode: 'ortho-hv' },
];

// Вспомогательная функция рендера иконки по имени
const RenderNodeIcon = ({ iconName, className = 'w-4 h-4' }) => {
  switch (iconName) {
    case 'Router': return <Router className={className} />;
    case 'Network': return <Network className={className} />;
    case 'Wifi': return <Wifi className={className} />;
    case 'Server': return <Server className={className} />;
    case 'Cpu': return <Cpu className={className} />;
    case 'HardDrive': return <HardDrive className={className} />;
    case 'Monitor': return <Monitor className={className} />;
    case 'Printer': return <Printer className={className} />;
    case 'Phone': return <Phone className={className} />;
    case 'Camera': return <Camera className={className} />;
    case 'Zap': return <Zap className={className} />;
    default: return <Cpu className={className} />;
  }
};

// ---------------------------- печать листа ------------------------------
const PRINT_COLOR_MAP: Record<string, string> = {
  '#09090A': '#FFFFFF', '#0F0F11': '#FFFFFF', '#101012': '#F8FAFC', '#17171A': '#F1F5F9',
  '#FFF5B8': '#111827', '#FFF8D6': '#111827', '#FFFDF0': '#FFFFFF', '#E6E0C2': '#111827',
  '#D8D2B4': '#334155', '#B9B28F': '#475569', '#8F8A6E': '#64748B', '#6B6552': '#64748B',
  '#2E2C1E': '#CBD5E1', '#26251D': '#E5E7EB', '#1F1F23': '#E5E7EB',
  '#FCD116': '#B45309', '#E3BC0E': '#B45309', '#F59E0B': '#B45309',
  '#34D399': '#047857', '#FB7185': '#BE123C', '#EF4444': '#DC2626', '#A78BFA': '#6D28D9',
  '#FB923C': '#C2410C', '#38BDF8': '#0369A1', '#fff': '#111827', '#FFFFFF': '#FFFFFF',
  '#0f172a': '#111827', '#1e293b': '#E5E7EB', '#64748b': '#64748B', '#94a3b8': '#94A3B8',
  'rgba(15,23,42,0.88)': '#FFFFFF', 'rgba(255,255,255,0.92)': '#FFFFFF',
  'rgba(148,163,184,0.4)': '#94A3B8',
};

const printEsc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cleanupPrintSheet() {
  document.body.classList.remove('printing');
  document.getElementById('print-sheet')?.remove();
}

export default function App() {
  // --- Состояния интерфейса ---
  const [darkMode, setDarkMode] = useState(SAVED?.darkMode ?? true);
  const [projectTitle, setProjectTitle] = useState(
    SAVED?.projectTitle ?? 'Карта сети — 1 этаж (Козина 7, пом. 1080 + 1079)'
  );
  const [viewMode, setViewMode] = useState('network'); // 'network' | 'walls' | 'bom'
  const [planFilter, setPlanFilter] = useState(() => {
    const saved = SAVED?.planFilter;
    return saved === '1080' || saved === '1079' ? saved : 'drawing';
  }); // 'unified' | '1080' | '1079'
  const [underlayOpacity, setUnderlayOpacity] = useState(SAVED?.underlayOpacity ?? 95);
  const [showGrid, setShowGrid] = useState(SAVED?.showGrid ?? true);
  const [showWifiHeatmap, setShowWifiHeatmap] = useState(SAVED?.showWifiHeatmap ?? true);
  const [showRoomLabels, setShowRoomLabels] = useState(SAVED?.showRoomLabels ?? true);
  const [showDimensions, setShowDimensions] = useState(SAVED?.showDimensions ?? true);
  const [planRotated, setPlanRotated] = useState(SAVED?.planRotated ?? false);

  // ---------------------------------------------------------------------------
  // СОВМЕСТНАЯ РАБОТА: вход, роли, синхронизация изменений в реальном времени
  // ---------------------------------------------------------------------------
  const applyingRemoteRef = useRef(false);
  const lastSyncedRef = useRef<SharedProject>({
    nodes: [], cables: [], walls: [], notes: [], projectTitle: '', planRotated: false,
  });
  const pendingOpsRef = useRef<Op[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const collabRef = useRef<any>(null);
  const printBuildRef = useRef<() => void>(() => {});
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const pushActivity = (userName: string, color: string, text: string) => {
    setActivity((prev) => [
      ...prev.slice(-11),
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, user: userName, color, text, at: new Date().toISOString() },
    ]);
  };

  const describeOps = (ops: Op[]) => {
    if (!ops.length) return 'обновил проект';
    const names: Record<string, string> = { node: 'узел', cable: 'кабель', wall: 'стену', note: 'пометку' };
    const verbs: Record<string, string> = { add: 'добавил', update: 'изменил', delete: 'удалил' };
    const op = ops[0];
    let text: string;
    if (op.kind === 'title.update') text = 'изменил название проекта';
    else if (op.kind === 'planRotated.update') text = op.value ? 'перевернул план на 180°' : 'вернул план в исходное положение';
    else {
      const [ent, act] = op.kind.split('.');
      text = `${verbs[act] || 'изменил'} ${names[ent] || 'объект'}`;
    }
    if (ops.length > 1) text += ` (+${ops.length - 1})`;
    return text;
  };

  const applyRemoteOps = (from: User, ops: Op[]) => {
    applyingRemoteRef.current = true;
    const cur = lastSyncedRef.current;
    const clone = (a: any[]) => a.map((x) => ({ ...x }));
    const nodes = clone(cur.nodes);
    const cables = clone(cur.cables);
    const walls = clone(cur.walls);
    const notes = clone(cur.notes);
    let title = cur.projectTitle;
    let rotated = !!cur.planRotated;
    for (const op of ops) {
      const [entity, action] = op.kind.split('.');
      if (entity === 'title') { title = String(op.value || ''); continue; }
      if (entity === 'planRotated') { rotated = !!op.value; continue; }
      const list = entity === 'node' ? nodes : entity === 'cable' ? cables : entity === 'wall' ? walls : entity === 'note' ? notes : null;
      if (!list) continue;
      if (action === 'add' && op.item) {
        if (!list.some((x: any) => x.id === op.item.id)) list.push(op.item);
      } else if (action === 'update' && op.id) {
        const i = list.findIndex((x: any) => x.id === op.id);
        if (i >= 0) list[i] = { ...list[i], ...(op.patch || {}), id: op.id };
      } else if (action === 'delete' && op.id) {
        const i = list.findIndex((x: any) => x.id === op.id);
        if (i >= 0) list.splice(i, 1);
      }
    }
    const next: SharedProject = { nodes, cables, walls, notes, projectTitle: title, planRotated: rotated };
    lastSyncedRef.current = next;
    setNodes(nodes);
    setCables(cables);
    setWalls(walls);
    setNotes(notes);
    if (title !== projectTitle) setProjectTitle(title);
    if (rotated !== planRotated) setPlanRotated(rotated);
    const color = collab.users.find((u) => u.login === from.login)?.color || '#FCD116';
    pushActivity(from.name || from.login, color, describeOps(ops));
    setTimeout(() => { applyingRemoteRef.current = false; }, 0);
  };

  const loadSharedProject = (proj: SharedProject) => {
    const next: SharedProject = {
      nodes: Array.isArray(proj.nodes) ? proj.nodes : [],
      cables: Array.isArray(proj.cables) ? proj.cables : [],
      walls: Array.isArray(proj.walls) ? proj.walls : [],
      notes: Array.isArray(proj.notes) ? proj.notes : [],
      projectTitle: proj.projectTitle || 'Карта сети — 1 этаж (Козина 7, пом. 1080 + 1079)',
      planRotated: !!proj.planRotated,
    };
    lastSyncedRef.current = { ...next };
    applyingRemoteRef.current = true;
    setNodes(next.nodes);
    setCables(next.cables);
    setWalls(next.walls);
    setNotes(next.notes);
    setProjectTitle(next.projectTitle);
    setPlanRotated(next.planRotated);
    setSelection({ type: null, id: null });
    setActivity([]);
    setTimeout(() => { applyingRemoteRef.current = false; }, 0);
  };

  const demoProjectSeed = (): SharedProject => {
    const [nx, ny] = roomPoint('1080', '12', -1.8, -2.4);
    return {
      nodes: DEMO_NODES.map((n) => ({ ...n })),
      cables: INITIAL_CABLES.map((c) => ({ ...c })),
      walls: INITIAL_WALLS.map((w) => ({ ...w })),
      notes: [
        { id: 'NOTE-1', x: nx, y: ny, text: 'Высота потолка h = 3.96 м (разводка в лотках)', layer: 'notes' },
        { id: 'NOTE-2', x: 15.63, y: 1.4, text: 'Стык планов 1080 и 1079', layer: 'notes' },
      ],
      projectTitle: 'Карта сети — 1 этаж (Козина 7, пом. 1080 + 1079)',
      planRotated: false,
    };
  };

  const collab = useCollab({
    onInit: (project, me, empty) => {
      if (empty && me.role === 'admin') {
        const seed = demoProjectSeed();
        loadSharedProject(seed);
        setTimeout(() => collabRef.current?.resetProject(seed), 250);
      } else {
        loadSharedProject(project);
      }
    },
    onOps: (from, ops) => applyRemoteOps(from, ops),
    onReset: (project) => loadSharedProject(project),
    onToast: (msg) => triggerToast(msg),
  });
  collabRef.current = collab;

  const showDrawingPlan = planFilter === 'drawing';
  const DRAW_BBOX = { x: 33, y: 223, w: 993, h: 580 };
  const DRAW_SX = (BUILDING.width * SCALE) / DRAW_BBOX.w;
  const DRAW_SY = (BUILDING.depth * SCALE) / DRAW_BBOX.h;
  const netReadOnly = collab.mode !== 'demo' && collab.user?.role === 'engineer';
  const canEditNetwork = !netReadOnly;




  // Поповеры в шапке
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [calibration, setCalibration] = useState(
    SAVED?.calibration ?? { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 }
  );
  const [toastMessage, setToastMessage] = useState(null);

  // --- Инструменты и активные элементы ---
  const [activeTool, setActiveTool] = useState('select'); // 'select' | 'pan' | 'place_node' | 'cable' | 'wall' | 'ruler' | 'note'
  const [pendingEquipment, setPendingEquipment] = useState(EQUIPMENT_CATALOG[0].items[1]);
  const [activeCableType, setActiveCableType] = useState(CABLE_TYPES[0]);
  const [activeLayerId, setActiveLayerId] = useState(SAVED?.activeLayerId ?? 'scs');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Данные проекта ---
  const [layers, setLayers] = useState(() => {
    const saved = Array.isArray(SAVED?.layers) ? SAVED.layers : [];
    const ids = new Set(saved.map((l: any) => l.id));
    return [...saved, ...INITIAL_LAYERS.filter((l: any) => !ids.has(l.id))];
  });
  const [walls, setWalls] = useState(SAVED?.walls ?? INITIAL_WALLS);
  const [nodes, setNodes] = useState(() => SAVED?.nodes ?? DEMO_NODES.map((n) => ({ ...n })));
  const nodesRef = useRef<any[]>([]);
  nodesRef.current = nodes;
  const [cables, setCables] = useState(SAVED?.cables ?? INITIAL_CABLES);
  const [notes, setNotes] = useState(() => {
    if (Array.isArray(SAVED?.notes)) return SAVED.notes;
    const [n1x, n1y] = roomPoint('1080', '12', -1.8, -2.4);
    return [
      { id: 'NOTE-1', x: n1x, y: n1y, text: 'Высота потолка h = 3.96 м (разводка в лотках)', layer: 'notes' },
      { id: 'NOTE-2', x: 15.63, y: 1.4, text: 'Стык планов 1080 и 1079', layer: 'notes' },
    ];
  });

  // Печать: перехват Ctrl+P и кнопки «Печать / PDF»
  useEffect(() => {
    const before = () => printBuildRef.current?.();
    const after = () => cleanupPrintSheet();
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  // локальные изменения -> операции для сервера
  useEffect(() => {
    const cur: SharedProject = { nodes, cables, walls, notes, projectTitle, planRotated };
    const prev = lastSyncedRef.current;
    const ops = diffOps(prev, cur);
    if (!ops.length) return;
    lastSyncedRef.current = cur;
    if (collab.mode !== 'online' || !collab.user || applyingRemoteRef.current) return;
    pendingOpsRef.current.push(...ops);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      const batch = pendingOpsRef.current.splice(0);
      if (batch.length) collab.sendOps(batch);
    }, 140);
  }, [nodes, cables, walls, notes, projectTitle, planRotated, collab.mode, collab.user, collab.sendOps]);

  // --- История для Undo / Redo ---
  const [history, setHistory] = useState([]);
  const [Selection, setSelection] = useState({ type: 'node', id: 'N-SW-1' }); // { type: 'node'|'cable'|'wall'|'note'|null, id }

  // --- Состояния интерактивного холста (Zoom, Pan, Drag, Drawing) ---
  const svgRef = useRef(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(SAVED?.zoom ?? 0.62);
  const [pan, setPan] = useState(SAVED?.pan ?? { x: 55, y: 105 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingItem, setDraggingItem] = useState(null); // { type: 'node'|'wall'|'note', id, offsetX, offsetY }
  const [cableStartNodeId, setCableStartNodeId] = useState(null);
  const [mouseMeters, setMouseMeters] = useState({ x: 15.0, y: 6.0 });
  const [rulerPoints, setRulerPoints] = useState(null); // { x1, y1, x2, y2, active }
  const [wallDraft, setWallDraft] = useState(null); // { x1, y1, x2, y2 }

  // Уведомление (Toast)
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Сохранение снимка в историю перед изменением
  const saveHistory = () => {
    setHistory((prev) => [
      ...prev.slice(-15),
      {
        nodes: JSON.parse(JSON.stringify(nodes)),
        cables: JSON.parse(JSON.stringify(cables)),
        walls: JSON.parse(JSON.stringify(walls)),
      }
    ]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setNodes(last.nodes);
    setCables(last.cables);
    setWalls(last.walls);
    setHistory((prev) => prev.slice(0, -1));
    triggerToast('Действие отменено (Undo)');
  };

  // Горячие клавиши как в Figma / CAD
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toLowerCase();
      if (key === 'v') setActiveTool('select');
      if (key === 'h') setActiveTool('pan');
      if (key === 'e' && canEditNetwork) setActiveTool('place_node');
      if (key === 'c' && canEditNetwork) {
        setActiveTool('cable');
        setCableStartNodeId(null);
      }
      if (key === 'w') setActiveTool('wall');
      if (key === 'm') {
        setActiveTool('ruler');
        setRulerPoints(null);
      }
      if (key === 't') setActiveTool('note');
      if (key === 'r') setPlanRotated((v) => !v);
      if (key === 'escape') {
        setCableStartNodeId(null);
        setRulerPoints(null);
        setWallDraft(null);
        setActiveTool('select');
      }
      if ((key === 'delete' || key === 'backspace') && Selection?.id) {
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [Selection, nodes, cables, walls, canEditNetwork, netReadOnly, collab.user]);

  // Перевод экранных координат мыши в метры здания
  const clientToMeters = (clientX, clientY) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    let pxX = (clientX - rect.left - pan.x - calibration.offsetX) / (zoom * calibration.scaleX);
    let pxY = (clientY - rect.top - pan.y - calibration.offsetY) / (zoom * calibration.scaleY);
    if (planRotated) {
      pxX = 2 * ROT_CX - pxX;
      pxY = 2 * ROT_CY - pxY;
    }
    return {
      x: Math.round((pxX / SCALE) * 20) / 20, // шаг привязки 5 см (0.05 м)
      y: Math.round((pxY / SCALE) * 20) / 20
    };
  };

  // Определение помещения по координатам (X, Y) — полигоны проверенной модели
  const pointInPoly = (x: number, y: number, poly: number[][]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
    }
    return inside;
  };
  const getRoomForPoint = (x: number, y: number) => {
    for (const r of INITIAL_ROOMS) {
      const parts: any[] = Array.isArray((r.polygon as any)[0][0]) ? (r.polygon as any) : [r.polygon];
      if (parts.some((p: number[][]) => pointInPoly(x, y, p)))
        return `Пом. ${r.premise} — №${r.num} (${r.name})`;
    }
    return 'Вне контура / Коридор';
  };

  // Расчет ортогональной трассы и точной длины кабеля в метрах (с учетом спуска с потолка h=3.96м)
  const computeCableMetrics = (cable) => {
    const n1 = nodes.find((n) => n.id === cable.from);
    const n2 = nodes.find((n) => n.id === cable.to);
    if (!n1 || !n2) return { points: '', pathPoints: [], lengthPlanM: 0, totalLengthM: 0 };

    const x1 = n1.x * SCALE;
    const y1 = n1.y * SCALE;
    const x2 = n2.x * SCALE;
    const y2 = n2.y * SCALE;

    let pathPoints = [];
    if (cable.routeMode === 'direct') {
      pathPoints = [
        { x: x1, y: y1 },
        { x: x2, y: y2 }
      ];
    } else if (cable.routeMode === 'ortho-vh') {
      pathPoints = [
        { x: x1, y: y1 },
        { x: x1, y: y2 },
        { x: x2, y: y2 }
      ];
    } else {
      // ortho-hv (по умолчанию)
      pathPoints = [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 }
      ];
    }

    const dx = Math.abs(n2.x - n1.x);
    const dy = Math.abs(n2.y - n1.y);
    const lengthPlanM = cable.routeMode === 'direct' ? Math.hypot(dx, dy) : dx + dy;

    // Учет вертикальных опусков от потолочного лотка (h=3.96м) до высоты монтажа обоих узлов + 12% запас на разделку
    const drop1 = Math.max(0.5, CEILING_HEIGHT - (n1.heightM ?? 1.0));
    const drop2 = Math.max(0.5, CEILING_HEIGHT - (n2.heightM ?? 1.0));
    const totalLengthM = Math.round((lengthPlanM + drop1 + drop2) * 1.12 * 10) / 10;

    return {
      points: pathPoints.map((p) => `${p.x},${p.y}`).join(' '),
      pathPoints,
      lengthPlanM: Math.round(lengthPlanM * 10) / 10,
      totalLengthM
    };
  };

  // Тестовый API (используется e2e-проверкой)
  useEffect(() => {
    (window as any).__netmapV2 = {
      counts: () => ({ nodes: nodes.length, cables: cables.length, walls: walls.length, layers: layers.length }),
      state: () => ({ nodes, cables, walls, layers, notes, projectTitle, darkMode, zoom, pan }),
      screenOf: (x: number, y: number) => {
        const r = svgRef.current?.getBoundingClientRect();
        if (!r) return { x: 0, y: 0 };
        let px = x * SCALE;
        let py = y * SCALE;
        if (planRotated) {
          px = 2 * ROT_CX - px;
          py = 2 * ROT_CY - py;
        }
        return { x: r.left + pan.x + px * zoom, y: r.top + pan.y + py * zoom };
      },
    };
  }, [nodes, cables, walls, layers, notes, projectTitle, darkMode, zoom, pan, planRotated]);

  // --- Обработчики мыши на холсте ---
  const handleCanvasMouseDown = (e) => {
    if (e.button === 1 || activeTool === 'pan' || e.spaceKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    const coords = clientToMeters(e.clientX, e.clientY);

    // Размещение нового оборудования
    if (activeTool === 'place_node' && pendingEquipment) {
      saveHistory();
      const count = nodes.filter((n) => n.type === pendingEquipment.type).length + 1;
      const newNode = {
        id: `N-${Date.now()}`,
        type: pendingEquipment.type,
        name: `${pendingEquipment.name} #${count}`,
        code: `${pendingEquipment.short}-${count}`,
        layer: pendingEquipment.layer,
        x: coords.x,
        y: coords.y,
        ip: `192.168.10.${100 + nodes.length}`,
        vlan: 'LAN (10)',
        model: pendingEquipment.model,
        port: `SW1:P${nodes.length + 1}`,
        heightM: pendingEquipment.type === 'wifi' || pendingEquipment.type === 'camera' ? 3.6 : 0.8,
        radius: pendingEquipment.radius || 7.5,
        notes: getRoomForPoint(coords.x, coords.y)
      };
      setNodes((prev) => [...prev, newNode]);
      setSelection({ type: 'node', id: newNode.id });
      triggerToast(`Добавлен узел ${newNode.code} (${coords.x}м, ${coords.y}м)`);
      return;
    }

    // Линейка / Замер расстояния
    if (activeTool === 'ruler') {
      if (!rulerPoints || !rulerPoints.active) {
        setRulerPoints({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y, active: true });
      } else {
        setRulerPoints((prev) => ({ ...prev, x2: coords.x, y2: coords.y, active: false }));
      }
      return;
    }

    // Рисование новой перегородки
    if (activeTool === 'wall') {
      if (!wallDraft) {
        setWallDraft({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y });
      } else {
        saveHistory();
        const newWall = {
          id: `P-NEW-${Date.now()}`,
          x1: wallDraft.x1,
          y1: wallDraft.y1,
          x2: coords.x,
          y2: coords.y,
          thickness: 0.12,
          loadBearing: false,
          name: 'Новая перегородка ГКЛ'
        };
        setWalls((prev) => [...prev, newWall]);
        setWallDraft(null);
        setSelection({ type: 'wall', id: newWall.id });
        triggerToast('Добавлена новая перегородка');
      }
      return;
    }

    // Добавление текстовой пометки
    if (activeTool === 'note') {
      const newNote = {
        id: `NOTE-${Date.now()}`,
        x: coords.x,
        y: coords.y,
        text: 'Новая пометка на схеме',
        layer: 'notes'
      };
      setNotes((prev) => [...prev, newNote]);
      setSelection({ type: 'note', id: newNote.id });
      setActiveTool('select');
      return;
    }

    // Если кликнули в пустое место в режиме выбора — снимаем выделение или начинаем панорамирование
    if (e.target === svgRef.current || e.target.dataset.bg === 'true') {
      setSelection({ type: null, id: null });
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleCanvasMouseMove = (e) => {
    const coords = clientToMeters(e.clientX, e.clientY);
    setMouseMeters(coords);
    if (collab.mode === 'online' && collab.user) {
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = setTimeout(() => collab.sendCursor(coords.x, coords.y), 60);
    }

    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    if (rulerPoints?.active) {
      setRulerPoints((prev) => ({ ...prev, x2: coords.x, y2: coords.y }));
      return;
    }

    if (wallDraft) {
      // Ортогональное выравнивание при рисовании стены
      const dx = Math.abs(coords.x - wallDraft.x1);
      const dy = Math.abs(coords.y - wallDraft.y1);
      setWallDraft((prev) => ({
        ...prev,
        x2: dx > dy ? coords.x : prev.x1,
        y2: dx > dy ? prev.y1 : coords.y
      }));
      return;
    }

    if (draggingItem) {
      if (draggingItem.type === 'node') {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === draggingItem.id
              ? { ...n, x: coords.x - draggingItem.offsetX, y: coords.y - draggingItem.offsetY }
              : n
          )
        );
      } else if (draggingItem.type === 'wall') {
        const dx = coords.x - draggingItem.startX;
        const dy = coords.y - draggingItem.startY;
        setWalls((prev) =>
          prev.map((w) =>
            w.id === draggingItem.id
              ? {
                  ...w,
                  x1: Math.round((draggingItem.origX1 + dx) * 20) / 20,
                  y1: Math.round((draggingItem.origY1 + dy) * 20) / 20,
                  x2: Math.round((draggingItem.origX2 + dx) * 20) / 20,
                  y2: Math.round((draggingItem.origY2 + dy) * 20) / 20
                }
              : w
          )
        );
      } else if (draggingItem.type === 'note') {
        setNotes((prev) =>
          prev.map((nt) =>
            nt.id === draggingItem.id ? { ...nt, x: coords.x, y: coords.y } : nt
          )
        );
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setDraggingItem(null);
  };

  // Клик или начало перетаскивания узла оборудования
  const handleNodeMouseDown = (e, node) => {
    if (netReadOnly) {
      setSelection({ type: 'node', id: node.id });
      return;
    }
    e.stopPropagation();
    const layerObj = layers.find((l) => l.id === node.layer);
    if (layerObj?.locked) {
      triggerToast(`Слой «${layerObj.name}» заблокирован`);
      return;
    }

    // Если активен инструмент прокладки кабеля
    if (activeTool === 'cable') {
      if (!cableStartNodeId) {
        setCableStartNodeId(node.id);
        triggerToast(`Начало трассы: ${node.code}. Выберите конечный узел.`);
      } else if (cableStartNodeId !== node.id) {
        saveHistory();
        const newCable = {
          id: `C-${Date.now()}`,
          from: cableStartNodeId,
          to: node.id,
          cableType: activeCableType.id,
          routeMode: 'ortho-hv'
        };
        setCables((prev) => [...prev, newCable]);
        setSelection({ type: 'cable', id: newCable.id });
        setCableStartNodeId(null);
        triggerToast(`Проложен кабель ${activeCableType.short}`);
      }
      return;
    }

    setSelection({ type: 'node', id: node.id });
    const coords = clientToMeters(e.clientX, e.clientY);
    setDraggingItem({
      type: 'node',
      id: node.id,
      offsetX: coords.x - node.x,
      offsetY: coords.y - node.y
    });
  };

  // Клик или перетаскивание стены/перегородки
  const handleWallMouseDown = (e, wall) => {
    e.stopPropagation();
    setSelection({ type: 'wall', id: wall.id });

    if (wall.loadBearing) {
      return; // Несущие стены двигать нельзя
    }
    const partLayer = layers.find((l) => l.id === 'partitions');
    if (partLayer?.locked) {
      triggerToast('Слой перегородок заблокирован');
      return;
    }

    const coords = clientToMeters(e.clientX, e.clientY);
    setDraggingItem({
      type: 'wall',
      id: wall.id,
      startX: coords.x,
      startY: coords.y,
      origX1: wall.x1,
      origY1: wall.y1,
      origX2: wall.x2,
      origY2: wall.y2
    });
  };

  // Удаление выбранного элемента
  const handleDeleteSelected = () => {
    if (netReadOnly && Selection.type !== 'wall' && Selection.type !== 'note') {
      triggerToast('Нет прав: сеть редактирует администратор');
      return;
    }
    if (!Selection?.id) return;
    saveHistory();
    if (Selection.type === 'node') {
      setNodes((prev) => prev.filter((n) => n.id !== Selection.id));
      setCables((prev) => prev.filter((c) => c.from !== Selection.id && c.to !== Selection.id));
      triggerToast('Узел и связанные кабели удалены');
    } else if (Selection.type === 'cable') {
      setCables((prev) => prev.filter((c) => c.id !== Selection.id));
      triggerToast('Кабельная трасса удалена');
    } else if (Selection.type === 'wall') {
      const targetWall = walls.find((w) => w.id === Selection.id);
      if (targetWall?.loadBearing) {
        triggerToast('Несущую конструкцию удалить нельзя!');
        return;
      }
      setWalls((prev) => prev.filter((w) => w.id !== Selection.id));
      triggerToast('Перегородка демонтирована');
    } else if (Selection.type === 'note') {
      setNotes((prev) => prev.filter((n) => n.id !== Selection.id));
    }
    setSelection({ type: null, id: null });
  };

  // Дублирование выбранного узла
  const handleDuplicateNode = (node) => {
    if (netReadOnly) {
      triggerToast('Нет прав: сеть редактирует администратор');
      return;
    }
    saveHistory();
    const copy = {
      ...node,
      id: `N-${Date.now()}`,
      code: `${node.code}-копия`,
      x: Math.round((node.x + 0.8) * 10) / 10,
      y: Math.round((node.y + 0.8) * 10) / 10
    };
    setNodes((prev) => [...prev, copy]);
    setSelection({ type: 'node', id: copy.id });
    triggerToast(`Узел ${node.code} дублирован`);
  };

  // Вписать проверенный план в экран (с центрированием)
  const handleFitView = () => {
    const svg = svgRef.current;
    const w = svg?.clientWidth || 1100;
    const h = svg?.clientHeight || 700;
    const padX = 90;
    const padY = 110;
    let minX = 0;
    let maxX = BUILDING.width;
    let minY = BUILDING.minY;
    let maxY = BUILDING.minY + BUILDING.height;
    for (const n of nodesRef.current) {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y);
    }
    const bw = Math.max(1, maxX - minX);
    const bh = Math.max(1, maxY - minY);
    const zx = (w - padX * 2) / (bw * SCALE);
    const zy = (h - padY * 2) / (bh * SCALE);
    const z = Math.max(0.3, Math.min(2.0, Math.min(zx, zy)));
    setZoom(Math.round(z * 100) / 100);
    setPan({
      x: Math.round((w - bw * SCALE * z) / 2 - minX * SCALE * z),
      y: Math.round((h - bh * SCALE * z) / 2 - minY * SCALE * z),
    });
  };

  // первично вписываем проверенный план в холст
  useEffect(() => {
    if (SAVED?.zoom && SAVED?.pan) return; // вид восстановлен из сохранения
    const t = setTimeout(() => handleFitView(), 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автосохранение проекта в браузере
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            projectTitle, nodes, cables, walls, layers, notes, activeLayerId,
            darkMode, planFilter, underlayOpacity, calibration,
            showGrid, showRoomLabels, showDimensions, showWifiHeatmap,
            zoom, pan, planRotated,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {
        /* ignore quota errors */
      }
    }, 350);
    return () => clearTimeout(t);
  }, [
    projectTitle, nodes, cables, walls, layers, notes, activeLayerId,
    darkMode, planFilter, underlayOpacity, calibration,
    showGrid, showRoomLabels, showDimensions, showWifiHeatmap, zoom, pan, planRotated,
  ]);

  // Экспорт кабельного журнала и спецификации в CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Категория', 'Код/Маркировка', 'Наименование/Модель', 'Слой', 'Помещение/Трасса', 'IP/Длина (м)', 'Примечание'];
    const rows = [
      ...nodes.map((n) => [
        n.id,
        'Оборудование',
        n.code,
        `${n.name} (${n.model})`,
        n.layer,
        getRoomForPoint(n.x, n.y),
        n.ip,
        n.notes || ''
      ]),
      ...cables.map((c) => {
        const metrics = computeCableMetrics(c);
        const n1 = nodes.find((n) => n.id === c.from);
        const n2 = nodes.find((n) => n.id === c.to);
        const cType = CABLE_TYPES.find((t) => t.id === c.cableType);
        return [
          c.id,
          'Кабельная трасса',
          cType?.short || c.cableType,
          cType?.name || '',
          cType?.layer || 'scs',
          `${n1?.code || '?'} -> ${n2?.code || '?'}`,
          `${metrics.totalLengthM} м`,
          `По плану: ${metrics.lengthPlanM} м + опуски`
        ];
      })
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers, ...rows].map((e) => e.map((v) => `"${v}"`).join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'kozina_7_scs_cable_schedule.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
    triggerToast('Кабельный журнал и спецификация выгружены в CSV');
  };

  // Экспорт проекта в JSON
  const handleExportJSON = () => {
    const payload = {
      version: 2,
      projectTitle, nodes, cables, walls, layers, notes, activeLayerId,
      darkMode, planFilter, underlayOpacity, calibration,
      showGrid, showRoomLabels, showDimensions, showWifiHeatmap, zoom, pan, planRotated,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kozina_7_network_plan.json';
    a.click();
    setShowExportMenu(false);
    triggerToast('Проект сохранён в JSON');
  };

  // Импорт проекта из JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data || (!Array.isArray(data.nodes) && !Array.isArray(data.cables))) {
          throw new Error('bad file');
        }
        if (data.projectTitle) setProjectTitle(data.projectTitle);
        if (Array.isArray(data.nodes)) setNodes(data.nodes);
        if (Array.isArray(data.cables)) setCables(data.cables);
        if (Array.isArray(data.walls)) setWalls(data.walls);
        if (Array.isArray(data.layers)) setLayers(data.layers);
        if (Array.isArray(data.notes)) setNotes(data.notes);
        if (data.activeLayerId) setActiveLayerId(data.activeLayerId);
        if (typeof data.darkMode === 'boolean') setDarkMode(data.darkMode);
        if (data.planFilter) setPlanFilter(data.planFilter);
        if (typeof data.underlayOpacity === 'number') setUnderlayOpacity(data.underlayOpacity);
        if (data.calibration) setCalibration(data.calibration);
        if (typeof data.zoom === 'number') setZoom(data.zoom);
        if (typeof data.planRotated === 'boolean') setPlanRotated(data.planRotated);
        if (data.pan) setPan(data.pan);
        triggerToast('Проект загружен из JSON');
      } catch {
        triggerToast('Не удалось прочитать JSON проекта');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- Вычисляемая статистика по проекту и выбранному объекту ---
  const netPlacedCount = nodes.filter((n: any) => String(n.id).startsWith('NET-')).length;

  const layerCounts = useMemo(() => {
    const counts = {};
    layers.forEach((l) => (counts[l.id] = 0));
    nodes.forEach((n) => {
      if (counts[n.layer] !== undefined) counts[n.layer] += 1;
    });
    walls.forEach((w) => {
      if (!w.loadBearing && counts.partitions !== undefined) counts.partitions += 1;
    });
    notes.forEach(() => {
      if (counts.notes !== undefined) counts.notes += 1;
    });
    return counts;
  }, [nodes, walls, notes, layers]);

  const cableSummary = useMemo(() => {
    const byType = {};
    CABLE_TYPES.forEach((t) => (byType[t.id] = { ...t, count: 0, totalMeters: 0 }));
    let grandTotalMeters = 0;

    cables.forEach((c) => {
      const m = computeCableMetrics(c);
      if (byType[c.cableType]) {
        byType[c.cableType].count += 1;
        byType[c.cableType].totalMeters = Math.round((byType[c.cableType].totalMeters + m.totalLengthM) * 10) / 10;
      }
      grandTotalMeters += m.totalLengthM;
    });

    return {
      list: Object.values(byType),
      grandTotalMeters: Math.round(grandTotalMeters * 10) / 10
    };
  }, [cables, nodes]);

  // Построение печатного листа: только чертёж, рамка, штамп и легенда
  const buildPrintSheet = () => {
    cleanupPrintSheet();
    const svgEl = svgRef.current;
    const planRoot = svgEl?.querySelector('[data-plan-root="1"]') as SVGGElement | null;
    if (!svgEl || !planRoot) return;

    const NS = 'http://www.w3.org/2000/svg';
    const defs = svgEl.querySelector('defs');
    const clone = planRoot.cloneNode(true) as SVGGElement;
    clone.removeAttribute('transform');

    // убрать интерактивные/экранные элементы
    clone.querySelectorAll('rect,circle,path').forEach((el) => {
      const fill = el.getAttribute('fill') || '';
      if (fill.includes('url(#wifiGradient)') || fill.includes('url(#grid-1m)')) el.remove();
    });

    const recolor = (el: Element) => {
      ['fill', 'stroke'].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (v && PRINT_COLOR_MAP[v]) el.setAttribute(attr, PRINT_COLOR_MAP[v]);
      });
    };
    if (defs) {
      const defsClone = defs.cloneNode(true) as SVGDefsElement;
      recolor(defsClone);
      defsClone.querySelectorAll('*').forEach(recolor);
      clone.insertBefore(defsClone, clone.firstChild);
    }
    recolor(clone);
    clone.querySelectorAll('*').forEach(recolor);

    // границы: здание + внешние узлы + запас (печать всегда в исходной ориентации)
    let minXm = 0;
    let maxXm = BUILDING.width;
    let minYm = BUILDING.minY;
    let maxYm = BUILDING.minY + BUILDING.height;
    for (const n of nodes) {
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
      minXm = Math.min(minXm, n.x);
      maxXm = Math.max(maxXm, n.x);
      minYm = Math.min(minYm, n.y);
      maxYm = Math.max(maxYm, n.y);
    }
    const margin = 0.9;
    const x0 = (minXm - margin) * SCALE;
    const y0 = (minYm - margin) * SCALE;
    const vbW = (maxXm - minXm + margin * 2) * SCALE;
    const vbH = (maxYm - minYm + margin * 2) * SCALE;

    const wrapper = document.createElementNS(NS, 'g');
    wrapper.appendChild(clone);

    let vx = x0;
    let vy = y0;
    let vw = vbW;
    let vh = vbH;
    if (planRotated) {
      const hx = Math.max(ROT_CX - x0, x0 + vbW - ROT_CX);
      const hy = Math.max(ROT_CY - y0, y0 + vbH - ROT_CY);
      vx = ROT_CX - hx;
      vy = ROT_CY - hy;
      vw = 2 * hx;
      vh = 2 * hy;
      wrapper.setAttribute('transform', `rotate(180 ${ROT_CX} ${ROT_CY})`);
    }

    const printSvg = document.createElementNS(NS, 'svg');
    printSvg.setAttribute('viewBox', `${vx} ${vy} ${vw} ${vh}`);
    printSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    printSvg.setAttribute('class', 'print-svg');
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('x', String(vx));
    bg.setAttribute('y', String(vy));
    bg.setAttribute('width', String(vw));
    bg.setAttribute('height', String(vh));
    bg.setAttribute('fill', '#FFFFFF');
    printSvg.appendChild(bg);
    printSvg.appendChild(wrapper);

    const layerLegend = layers
      .filter((l: any) => l.visible)
      .map(
        (l: any) =>
          `<span class="pl-item"><i style="background:${PRINT_COLOR_MAP[l.color] || l.color}"></i>${printEsc(l.name)}</span>`
      )
      .join('');
    const cableLegend = cableSummary.list
      .filter((t: any) => t.count > 0)
      .map(
        (t: any) =>
          `<span class="pl-item"><i class="line" style="background:${PRINT_COLOR_MAP[t.color] || t.color}"></i>${printEsc(
            t.short
          )}: ${t.totalMeters} м (${t.count})</span>`
      )
      .join('');

    const userLabel = collab.user ? `${printEsc(collab.user.name)} · ${printEsc(collab.user.role === 'admin' ? 'администратор' : 'инженер')}` : 'локальный режим';

    const sheet = document.createElement('div');
    sheet.id = 'print-sheet';
    sheet.innerHTML = `
      <div class="print-head">
        <div>
          <div class="print-brand">MKSPEC · КАРТА СЕТИ</div>
          <h1>${printEsc(projectTitle)}</h1>
          <div class="print-sub">г. Казань, ул. Алексея Козина, д. 7 · помещения 1080 + 1079 · 1 этаж</div>
        </div>
        <div class="print-meta">
          <div><b>Масштаб 1:100</b> · h = 3.96 м</div>
          <div>Площадь: ${Math.round(TOTAL_AREA)} м² · стен: ${walls.length}</div>
          <div>${new Date().toLocaleDateString('ru-RU')} · лист 1 из 1</div>
          <div>${userLabel}</div>
        </div>
      </div>
      <div class="print-plan"></div>
      <div class="print-foot">
        <div class="print-legend">${layerLegend}</div>
        <div class="print-legend">${cableLegend}</div>
      </div>
      <div class="print-note">Схема сети: узлов ${nodes.length}, кабельных трасс ${cables.length}, суммарный метраж ${cableSummary.grandTotalMeters} м. Слой «VPN / шлюз» — логические объекты документации.</div>
    `;
    (sheet.querySelector('.print-plan') as HTMLElement).appendChild(printSvg);
    document.body.appendChild(sheet);
    document.body.classList.add('printing');
  };

  const handlePrint = () => {
    buildPrintSheet();
    setTimeout(() => window.print(), 80);
  };
  printBuildRef.current = buildPrintSheet;

  const selectedObject = useMemo(() => {
    if (!Selection?.id) return null;
    if (Selection.type === 'node') return nodes.find((n) => n.id === Selection.id);
    if (Selection.type === 'cable') return cables.find((c) => c.id === Selection.id);
    if (Selection.type === 'wall') return walls.find((w) => w.id === Selection.id);
    if (Selection.type === 'note') return notes.find((n) => n.id === Selection.id);
    return null;
  }, [Selection, nodes, cables, walls, notes]);

  // Фильтрация каталога оборудования по поиску
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return EQUIPMENT_CATALOG;
    const q = searchQuery.toLowerCase();
    return EQUIPMENT_CATALOG.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.short.toLowerCase().includes(q) ||
          item.model.toLowerCase().includes(q)
      )
    })).filter((g) => g.items.length > 0);
  }, [searchQuery]);

  if (collab.mode === 'loading') {
    return (
      <div className="h-screen w-screen bg-cyber-bg text-cyber-text flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-xl border border-primary/70 bg-primary/10 flex items-center justify-center glow-primary">
          <span className="font-display font-black text-primary text-xl leading-none">K</span>
        </div>
        <div className="font-mono text-xs text-ink-300">Подключение к серверу…</div>
      </div>
    );
  }

  if (collab.mode === 'auth') {
    return (
      <LoginScreen
        onLogin={collab.login}
        error={collab.error}
        busy={collab.busy}
        hint="Пароль можно сменить после входа — клик по своему имени в шапке."
      />
    );
  }

  return (
    <div
      className={`h-screen w-screen overflow-hidden flex flex-col select-none font-sans transition-colors duration-200 ${
        darkMode ? 'dark bg-cyber-bg text-cyber-text' : 'bg-paper text-ink-700'
      }`}
    >
      {/* =====================================================================
          1. ВЕРХНЯЯ ПАНЕЛЬ (КОМПАКТНЫЙ HEADER В СТИЛЕ UNIFI / FIGMA)
      ===================================================================== */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportJSON}
      />

      <header
        className={`h-13 px-3 border-b flex items-center justify-between gap-2 z-30 shrink-0 ${
          darkMode
            ? 'bg-cyber-card/95 border-ink-800 text-cyber-text backdrop-blur'
            : 'bg-paper border-hairline text-ink-700 shadow-2xs'
        }`}
      >
        {/* Левая группа: логотип, название проекта и быстрые настройки чертежа */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg border border-primary/70 bg-primary/10 flex items-center justify-center shrink-0 glow-primary">
            <span className="font-display font-black text-primary text-lg leading-none">K</span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className={`font-display text-sm font-bold tracking-tight bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 rounded px-1.5 py-0.5 outline-none truncate w-72 lg:w-84 transition ${
                  darkMode ? 'text-slate-100' : 'text-slate-900'
                }`}
              />
              {collab.mode !== 'demo' ? (
                <OnlineBadge
                  mode={collab.mode}
                  user={collab.user}
                  users={collab.users}
                  onLogout={() => {
                    if (window.confirm('Выйти из системы?')) collab.logout();
                  }}
                  onChangePassword={() => setShowPassword(true)}
                />
              ) : (
                <span className="hidden xl:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Check className="w-3 h-3" /> Локальный режим
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 px-1.5">
              <span className="font-mono uppercase tracking-[0.12em] text-[10px]">Масштаб 1:100 · h=3.96 м · площадь {Math.round(TOTAL_AREA)} м² · проверенный план БТИ</span>
            </div>
          </div>

          <div className={`h-5 w-px mx-1 ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`} />

          {/* Селектор подложки (единый план или отдельные секции) */}
          <div className="hidden md:flex items-center gap-1.5">
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className={`text-xs font-medium rounded-lg px-2.5 py-1.5 border outline-none transition cursor-pointer ${
                darkMode
                  ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <option value="drawing">Чертёж: актуальный (весь объект)</option>
              <option value="1080">Модель: только пом. 1080</option>
              <option value="1079">Модель: только пом. 1079</option>
            </select>

            {/* Компактный поповер калибровки и прозрачности подложки (вместо загромождения правой панели!) */}
            <div className="relative">
              <button
                onClick={() => setShowCalibrationModal(!showCalibrationModal)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition ${
                  showCalibrationModal
                    ? 'bg-blue-600 text-white border-blue-600'
                    : darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
                title="Прозрачность и калибровка чертежа"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Чертёж {underlayOpacity}%</span>
              </button>

              {showCalibrationModal && (
                <div
                  className={`absolute left-0 mt-2 w-72 rounded-xl p-4 shadow-xl border z-50 ${
                    darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Подложка и калибровка
                    </span>
                    <button
                      onClick={() => setShowCalibrationModal(false)}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Прозрачность чертежа</span>
                        <span className="font-semibold text-blue-600">{underlayOpacity}%</span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="100"
                        value={underlayOpacity}
                        onChange={(e) => setUnderlayOpacity(Number(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span>Показывать площади и № комнат</span>
                      <input
                        type="checkbox"
                        checked={showRoomLabels}
                        onChange={(e) => setShowRoomLabels(e.target.checked)}
                        className="accent-blue-600 rounded"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span>Показывать размеры стен (м)</span>
                      <input
                        type="checkbox"
                        checked={showDimensions}
                        onChange={(e) => setShowDimensions(e.target.checked)}
                        className="accent-blue-600 rounded"
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span className="block text-[11px] font-semibold text-slate-400 mb-2">
                        ТОЧНАЯ КАЛИБРОВКА ПОДЛОЖКИ
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400">Сдвиг X (px)</label>
                          <input
                            type="number"
                            value={calibration.offsetX}
                            onChange={(e) => setCalibration({ ...calibration, offsetX: Number(e.target.value) })}
                            className={`w-full mt-0.5 px-2 py-1 rounded border text-xs ${
                              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Сдвиг Y (px)</label>
                          <input
                            type="number"
                            value={calibration.offsetY}
                            onChange={(e) => setCalibration({ ...calibration, offsetY: Number(e.target.value) })}
                            className={`w-full mt-0.5 px-2 py-1 rounded border text-xs ${
                              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Масштаб X</label>
                          <input
                            type="number"
                            step="0.05"
                            value={calibration.scaleX}
                            onChange={(e) => setCalibration({ ...calibration, scaleX: Number(e.target.value) || 1 })}
                            className={`w-full mt-0.5 px-2 py-1 rounded border text-xs ${
                              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400">Масштаб Y</label>
                          <input
                            type="number"
                            step="0.05"
                            value={calibration.scaleY}
                            onChange={(e) => setCalibration({ ...calibration, scaleY: Number(e.target.value) || 1 })}
                            className={`w-full mt-0.5 px-2 py-1 rounded border text-xs ${
                              darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                            }`}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => setCalibration({ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 })}
                        className="w-full mt-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
                      >
                        Сбросить калибровку (1:1)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Центральный сегментированный переключатель режимов работы */}
        <div
          className={`flex items-center p-1 rounded-xl border ${
            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200/80'
          }`}
        >
          <button
            onClick={() => setViewMode('network')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              viewMode === 'network'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Схема СКС</span>
          </button>

          <button
            onClick={() => {
              setViewMode('walls');
              setActiveTool('wall');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              viewMode === 'walls'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BrickWall className="w-3.5 h-3.5" />
            <span>Редактор стен</span>
          </button>

          <button
            onClick={() => setViewMode('bom')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              viewMode === 'bom'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Кабельный журнал ({cables.length})</span>
          </button>

          {collab.mode !== 'demo' && (
            <button
              onClick={() => setViewMode('docs')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                viewMode === 'docs'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Сеть офиса</span>
            </button>
          )}
        </div>

        {/* Правая группа: Undo/Redo, Wi-Fi Карта, Тема, Экспорт */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className={`p-1.5 rounded-lg border transition ${
              history.length === 0
                ? 'opacity-40 cursor-not-allowed border-transparent'
                : darkMode
                ? 'border-slate-800 hover:bg-slate-800 text-slate-300'
                : 'border-slate-200 hover:bg-slate-100 text-slate-600'
            }`}
            title="Отменить (Undo)"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowWifiHeatmap(!showWifiHeatmap)}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              showWifiHeatmap
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-300'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
            title="Показать / скрыть радиус покрытия точек доступа Wi-Fi"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Wi-Fi 5GHz</span>
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-1.5 rounded-lg border transition ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title={darkMode ? 'Светлая инженерная тема' : 'Тёмная тема (Blueprint CAD)'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              setNodes(DEMO_NODES.map((n) => ({ ...n })));
              setCables(INITIAL_CABLES);
              setWalls(INITIAL_WALLS);
              triggerToast('Демонстрационная схема Козина 7 восстановлена');
            }}
            className={`${netReadOnly ? 'hidden' : 'hidden lg:flex'} items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Демо</span>
          </button>

          {/* Выпадающее меню Экспорта / Импорта */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Экспорт</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showExportMenu && (
              <div
                className={`absolute right-0 mt-2 w-60 rounded-xl p-1.5 shadow-xl border z-50 text-xs ${
                  darkMode ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <button
                  onClick={() => {
                    setShowExportMenu(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition"
                >
                  <Upload className="w-4 h-4 text-amber-500" />
                  <div>
                    <div className="font-semibold">Загрузить проект (JSON)</div>
                    <div className="text-[10px] text-slate-400">Восстановить сохранённую схему</div>
                  </div>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <div>
                    <div className="font-semibold">Кабельный журнал (CSV)</div>
                    <div className="text-[10px] text-slate-400">Таблица узлов, трасс и метража</div>
                  </div>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition"
                >
                  <FileText className="w-4 h-4 text-blue-500" />
                  <div>
                    <div className="font-semibold">Сохранить проект (JSON)</div>
                    <div className="text-[10px] text-slate-400">Полная резервная копия со слоями</div>
                  </div>
                </button>
                <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
                <button
                  onClick={() => {
                    handlePrint();
                    setShowExportMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 text-left transition"
                >
                  <Printer className="w-4 h-4 text-indigo-500" />
                  <div>
                    <div className="font-semibold">Печать / PDF чертежа</div>
                    <div className="text-[10px] text-slate-400">Готовый лист формата А3 / А4</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {collab.mode === 'offline' && (
        <div className="z-40 bg-rose-500/15 border-b border-rose-500/30 text-rose-200 text-[11px] px-3 py-1 text-center">
          Нет связи с сервером — изменения не синхронизируются. Идёт переподключение…
        </div>
      )}

      {/* =====================================================================
          ОСНОВНАЯ РАБОЧАЯ ОБЛАСТЬ (ЛЕВАЯ ПАНЕЛЬ + ХОЛСТ / ТАБЛИЦА + ПРАВАЯ ПАНЕЛЬ)
      ===================================================================== */}
      {viewMode === 'bom' ? (
        /* РЕЖИМ 3: СПЕЦИФИКАЦИЯ И КАБЕЛЬНЫЙ ЖУРНАЛ (BOM) */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">Спецификация оборудования и Кабельный журнал СКС</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Объект: г. Казань, ул. Алексея Козина, д. 7 (Помещения 1080 + 1079, 1 этаж) • Автоматический расчёт с запасом 12% и опусками с потолка h = 3.96 м
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Скачать спецификацию в Excel / CSV
                </button>
                <button
                  onClick={() => setViewMode('network')}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Вернуться к чертежу
                </button>
              </div>
            </div>

            {/* Карточки сводки метража кабеля */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {cableSummary.list.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[11px] font-semibold text-slate-400">{item.count} линий</span>
                  </div>
                  <div className="text-lg font-bold">{item.totalMeters} м</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.name}</div>
                  <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    Бухт по 305м: <strong className="text-slate-700 dark:text-slate-200">{Math.ceil(item.totalMeters / 305) || 0} шт.</strong>
                  </div>
                </div>
              ))}
            </div>

            {/* Таблица Кабельного журнала */}
            <div
              className={`rounded-2xl border overflow-hidden ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
              }`}
            >
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold">Кабельный журнал трасс ({cables.length} линий)</span>
                <span className="text-xs font-semibold text-blue-600">
                  Общий метраж по зданию: {cableSummary.grandTotalMeters} м
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${darkMode ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      <th className="py-2.5 px-4">ID трассы</th>
                      <th className="py-2.5 px-4">Тип кабеля</th>
                      <th className="py-2.5 px-4">Откуда (Кросс/Узел)</th>
                      <th className="py-2.5 px-4">Куда (Конечная точка)</th>
                      <th className="py-2.5 px-4">Помещение назначения</th>
                      <th className="py-2.5 px-4">Длина по плану</th>
                      <th className="py-2.5 px-4">Итого с опусками (+12%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {cables.map((c, idx) => {
                      const n1 = nodes.find((n) => n.id === c.from);
                      const n2 = nodes.find((n) => n.id === c.to);
                      const cType = CABLE_TYPES.find((t) => t.id === c.cableType);
                      const m = computeCableMetrics(c);
                      return (
                        <tr key={c.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50">
                          <td className="py-2.5 px-4 font-mono font-semibold">LINE-{String(idx + 1).padStart(2, '0')}</td>
                          <td className="py-2.5 px-4">
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cType?.color }} />
                              {cType?.short}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-semibold">{n1 ? `${n1.code} (${n1.name})` : c.from}</td>
                          <td className="py-2.5 px-4 font-semibold">{n2 ? `${n2.code} (${n2.name})` : c.to}</td>
                          <td className="py-2.5 px-4 text-slate-500">{n2 ? getRoomForPoint(n2.x, n2.y) : '—'}</td>
                          <td className="py-2.5 px-4">{m.lengthPlanM} м</td>
                          <td className="py-2.5 px-4 font-bold text-blue-600 dark:text-blue-400">{m.totalLengthM} м</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Таблица активного и пассивного оборудования */}
            <div
              className={`rounded-2xl border overflow-hidden ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
              }`}
            >
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold">Ведомость узлов оборудования ({nodes.length} ед.)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={`border-b ${darkMode ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      <th className="py-2.5 px-4">Код</th>
                      <th className="py-2.5 px-4">Наименование</th>
                      <th className="py-2.5 px-4">Модель</th>
                      <th className="py-2.5 px-4">IP-адрес / VLAN</th>
                      <th className="py-2.5 px-4">Порт включения</th>
                      <th className="py-2.5 px-4">Расположение (Помещение)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {nodes.map((n) => (
                      <tr key={n.id} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-4 font-bold">{n.code}</td>
                        <td className="py-2.5 px-4">{n.name}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-500">{n.model}</td>
                        <td className="py-2.5 px-4 font-mono">{n.ip} <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{n.vlan}</span></td>
                        <td className="py-2.5 px-4 font-mono">{n.port}</td>
                        <td className="py-2.5 px-4 text-slate-500">{getRoomForPoint(n.x, n.y)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === 'docs' && collab.mode !== 'demo' ? (
        <OfficeDocs canPlace={!netReadOnly} placedCount={netPlacedCount} />
      ) : (
        /* РЕЖИМ 1 И 2: ГЛАВНЫЙ ГРАФИЧЕСКИЙ РЕДАКТОР СХЕМЫ И СТЕН */
        <div className="flex-1 flex min-h-0 relative overflow-hidden">
          {/* =================================================================
              2. ЛЕВАЯ ПАНЕЛЬ: КОМПАКТНАЯ БИБЛИОТЕКА УЗЛОВ И КАБЕЛЕЙ
          ================================================================= */}
          <aside
            className={`w-64 border-r flex flex-col z-20 shrink-0 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
            }`}
          >
            {/* Поиск по оборудованию */}
            <div className="p-2.5 border-b border-slate-200/80 dark:border-slate-800">
              <div
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                  darkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200/90 text-slate-700'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Поиск: роутер, ПК, камера..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none w-full text-xs"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}>
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Прокручиваемый каталог компонентов */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
              {/* Секции оборудования (2 колонки, компактные карточки) */}
              {filteredCatalog.map((section) => (
                <div key={section.group}>
                  <div className="px-1 mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                      {section.group}
                    </span>
                    <span className="text-[10px] text-slate-400">Клик → на чертёж</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {section.items.map((item) => {
                      const isSelected = activeTool === 'place_node' && pendingEquipment?.type === item.type;
                      const layerColor = layers.find((l) => l.id === item.layer)?.color || '#FCD116';
                      return (
                        <button
                          key={item.type}
                          onClick={() => {
                            setPendingEquipment(item);
                            setActiveTool('place_node');
                          }}
                          className={`group flex flex-col items-start p-2 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/10 border-blue-600 ring-1 ring-blue-600/30'
                              : darkMode
                              ? 'bg-slate-800/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                              : 'bg-slate-50/70 border-slate-200/80 hover:border-slate-300 hover:bg-white hover:shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-1">
                            <span
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white shadow-2xs"
                              style={{ backgroundColor: layerColor }}
                            >
                              <RenderNodeIcon iconName={item.icon} className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400 group-hover:text-blue-500">
                              {item.short}
                            </span>
                          </div>
                          <div className="text-[11px] font-semibold leading-tight line-clamp-1">
                            {item.name}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate w-full mt-0.5">
                            {item.model}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Секция выбора типа кабеля для прокладки */}
              <div>
                <div className="px-1 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                    КАБЕЛИ И ТРАССЫ (КЛАВИША C)
                  </span>
                </div>
                <div className="space-y-1">
                  {CABLE_TYPES.map((cab) => {
                    const isSelected = activeTool === 'cable' && activeCableType.id === cab.id;
                    return (
                      <button
                        key={cab.id}
                        onClick={() => {
                          setActiveCableType(cab);
                          setActiveTool('cable');
                          setCableStartNodeId(null);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/10 border-blue-600 font-semibold'
                            : darkMode
                            ? 'bg-slate-800/40 border-slate-800 hover:bg-slate-800'
                            : 'bg-slate-50/80 border-slate-200/80 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span
                            className="w-5 h-0.5 shrink-0"
                            style={{
                              backgroundColor: cab.dashed ? 'transparent' : cab.color,
                              borderTop: cab.dashed ? `2.5px dashed ${cab.color}` : `2.5px solid ${cab.color}`
                            }}
                          />
                          <span className="truncate">{cab.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 ml-1 shrink-0">
                          {cab.short.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Быстрая памятка по работе со стенами */}
              <div
                className={`p-3 rounded-xl border text-[11px] space-y-1.5 ${
                  darkMode ? 'bg-slate-950/70 border-slate-800 text-slate-400' : 'bg-blue-50/50 border-blue-100 text-slate-600'
                }`}
              >
                <div className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <BrickWall className="w-3.5 h-3.5" />
                  <span>Редактирование стен</span>
                </div>
                <p className="leading-relaxed">
                  Серon-синие перегородки можно выделять и перетаскивать мышью. Тёмные капитальные стены и пилоны (0.21 м) защищены от сноса.
                </p>
              </div>
            </div>
          </aside>

          {/* =================================================================
              3. ЦЕНТРАЛЬНЫЙ ИНТЕРАКТИВНЫЙ ХОЛСТ С ПЛАВАЮЩИМ ДОКОМ ИНСТРУМЕНТОВ
          ================================================================= */}
          <main className="flex-1 relative overflow-hidden flex flex-col">
            {/* ПЛАВАЮЩИЙ ДОК ИНСТРУМЕНТОВ СВЕРХУ ПО ЦЕНТРУ (В СТИЛЕ FIGMA / UNIFI) */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1.5 rounded-2xl shadow-lg border backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-slate-200/90 dark:border-slate-700/80">
              {[
                { id: 'select', label: 'Выбор', shortcut: 'V', icon: MousePointer },
                { id: 'pan', label: 'Панорама', shortcut: 'H', icon: Hand },
                { id: 'place_node', label: 'Узел', shortcut: 'E', icon: Cpu },
                { id: 'cable', label: 'Кабель', shortcut: 'C', icon: Cable },
                { id: 'wall', label: 'Перегородка', shortcut: 'W', icon: BrickWall },
                { id: 'ruler', label: 'Линейка', shortcut: 'M', icon: Ruler },
                { id: 'note', label: 'Текст', shortcut: 'T', icon: Type },
              ].map((t) => {
                const IconComp = t.icon;
                const active = activeTool === t.id;
                const locked = netReadOnly && (t.id === 'place_node' || t.id === 'cable');
                return (
                  <button
                    key={t.id}
                    disabled={locked}
                    onClick={() => {
                      if (locked) {
                        triggerToast('Роль «инженер»: сеть доступна только для просмотра');
                        return;
                      }
                      setActiveTool(t.id);
                      setCableStartNodeId(null);
                      setWallDraft(null);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      active
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title={locked ? 'Нет прав: сеть редактирует администратор' : `${t.label} (${t.shortcut})`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">{t.label}</span>
                    <kbd
                      className={`text-[10px] px-1 rounded ${
                        active
                          ? 'bg-blue-700 text-blue-100'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {t.shortcut}
                    </kbd>
                  </button>
                );
              })}
            </div>

            {/* Контекстная плашка-подсказка при активном инструменте прокладки кабеля или замера */}
            {(activeTool === 'cable' || activeTool === 'place_node' || activeTool === 'wall' || activeTool === 'ruler') && (
              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full text-xs font-medium shadow-md border backdrop-blur-md bg-blue-600/95 text-white border-blue-500 flex items-center gap-2">
                {activeTool === 'cable' && (
                  <>
                    <Cable className="w-3.5 h-3.5" />
                    <span>
                      {cableStartNodeId
                        ? 'Теперь кликните по конечному узлу для завершения трассы (Esc — отмена)'
                        : `Режим прокладки «${activeCableType.short}»: кликните по начальному узлу на чертеже`}
                    </span>
                  </>
                )}
                {activeTool === 'place_node' && (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    <span>
                      Размещение «{pendingEquipment?.name}»: кликните в любую точку плана (Esc — выход)
                    </span>
                  </>
                )}
                {activeTool === 'wall' && (
                  <>
                    <BrickWall className="w-3.5 h-3.5" />
                    <span>
                      {wallDraft
                        ? 'Кликните вторую точку для фиксации перегородки'
                        : 'Кликните начальную точку новой перегородки или перетащите существующую'}
                    </span>
                  </>
                )}
                {activeTool === 'ruler' && (
                  <>
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Кликните две точки на плане для точного замера расстояния в метрах</span>
                  </>
                )}
              </div>
            )}

            {/* Toast-уведомление */}
            {toastMessage && (
              <div className="absolute top-16 right-4 z-30 px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-lg border border-slate-700 flex items-center gap-2 animate-fade-in">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{toastMessage}</span>
              </div>
            )}

            {/* ГЛАВНЫЙ ВЕКТОРНЫЙ ХОЛСТ SVG */}
            <svg
              ref={svgRef}
              textRendering="geometricPrecision"
              shapeRendering="geometricPrecision"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.08 : -0.08;
                setZoom((z) => Math.min(2.4, Math.max(0.35, Math.round((z + delta) * 100) / 100)));
              }}
              className={`w-full h-full flex-1 ${
                isPanning || activeTool === 'pan'
                  ? 'cursor-grabbing'
                  : activeTool === 'select'
                  ? 'cursor-default'
                  : 'cursor-crosshair'
              }`}
              style={{
                backgroundColor: darkMode ? '#09090A' : '#FFFDF0'
              }}
            >
              <defs>
                {/* Инженерная миллиметровая сетка (шаг 1 метр = 32px) */}
                <pattern id="grid-1m" width={SCALE} height={SCALE} patternUnits="userSpaceOnUse">
                  <path
                    d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`}
                    fill="none"
                    stroke={darkMode ? '#26251D' : '#E6E0C2'}
                    strokeWidth="0.9"
                  />
                  <circle
                    cx={SCALE / 2}
                    cy={SCALE / 2}
                    r="1.1"
                    fill={darkMode ? 'rgba(252,209,22,0.22)' : 'rgba(142,117,29,0.22)'}
                  />
                </pattern>
                {/* Радиальный градиент для зоны покрытия Wi-Fi */}
                <radialGradient id="wifiGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FCD116" stopOpacity="0.22" />
                  <stop offset="65%" stopColor="#8E751D" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#8E751D" stopOpacity="0.0" />
                </radialGradient>
              </defs>

              {/* Фоновый прямоугольник для панорамирования */}
              <rect width="100%" height="100%" fill="transparent" data-bg="true" />

              {/* Группа трансформации (Панорама + Масштаб + Калибровка) */}
              <g
                data-plan-root="1"
                transform={`translate(${pan.x + calibration.offsetX}, ${pan.y + calibration.offsetY}) scale(${
                  zoom * calibration.scaleX
                }, ${zoom * calibration.scaleY}) rotate(${planRotated ? 180 : 0} ${ROT_CX} ${ROT_CY})`}
              >
                {/* 1. Сетка 1х1 метр */}
                {showGrid && (
                  <rect
                    x={-4 * SCALE}
                    y={-4 * SCALE}
                    width={42 * SCALE}
                    height={25 * SCALE}
                    fill="url(#grid-1m)"
                    data-bg="true"
                  />
                )}

                {/* 2. ПОДЛОЖКА: верный чертёж (SVG) или старая векторная модель */}
                {showDrawingPlan && (
                  <image
                    href={planDrawingUrl}
                    x={-DRAW_BBOX.x * DRAW_SX}
                    y={-DRAW_BBOX.y * DRAW_SY}
                    width={1152 * DRAW_SX}
                    height={928 * DRAW_SY}
                    preserveAspectRatio="none"
                    opacity={underlayOpacity / 100}
                    className="plan-image"
                    data-bg="true"
                  />
                )}

                <g
                  opacity={underlayOpacity / 100}
                  style={showDrawingPlan ? { display: 'none' } : undefined}
                >
                  {/* Входные крыльца и пандус — контуры из проверенной модели */}
                  {EXTERIOR_ENTRIES.map((ext) => {
                    const parts: any[] = Array.isArray((ext.polygon as any)[0][0]) ? (ext.polygon as any) : [ext.polygon];
                    const c = parts[0]
                      .reduce((a: number[], p: number[]) => [a[0] + p[0], a[1] + p[1]], [0, 0])
                      .map((v: number) => v / parts[0].length);
                    return (
                      <g key={ext.id}>
                        {parts.map((poly: number[][], i: number) => (
                          <polygon
                            key={i}
                            points={poly.map((p) => `${p[0] * SCALE},${p[1] * SCALE}`).join(' ')}
                            fill={darkMode ? '#17171A' : '#FFFDF0'}
                            stroke={darkMode ? '#8E751D' : '#B9B28F'}
                            strokeWidth="1.5"
                            strokeDasharray="5,4"
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* Контуры и заливка помещений — полигоны проверенной модели */}
                  {INITIAL_ROOMS.filter((r) => planFilter === 'unified' || r.premise === planFilter).map((room) => {
                    const is1080 = room.premise === '1080';
                    const fillLight = is1080 ? '#FFFDF0' : '#FFF8D6';
                    const fillDark = is1080 ? '#101012' : '#17171A';
                    const parts: any[] = Array.isArray((room.polygon as any)[0][0]) ? (room.polygon as any) : [room.polygon];
                    return (
                      <g key={room.id} data-bg="true">
                        {parts.map((poly: number[][], i: number) => (
                          <polygon
                            key={i}
                            points={poly.map((p) => `${p[0] * SCALE},${p[1] * SCALE}`).join(' ')}
                            fill={darkMode ? fillDark : fillLight}
                            stroke={darkMode ? '#2E2C1E' : '#E6E0C2'}
                            strokeWidth="1"
                            data-bg="true"
                          />
                        ))}
                      </g>
                    );
                  })}

                  {/* СТЕНА И ПЕРЕГОРОДКИ (НЕСУЩИЕ + РЕДАКТИРУЕМЫЕ) */}
                  {walls.map((w) => {
                    const isSelected = Selection?.type === 'wall' && Selection?.id === w.id;
                    const partLayer = layers.find((l) => l.id === 'partitions');
                    if (!w.loadBearing && !partLayer?.visible) return null;

                    const strokeColor = isSelected
                      ? '#FCD116'
                      : w.isSeam
                      ? '#FCD116'
                      : w.loadBearing
                      ? darkMode
                        ? '#E6E0C2'
                        : '#2E2C1E'
                      : darkMode
                      ? '#6B6552'
                      : '#8F8A6E';

                    const lengthM = Math.round(Math.hypot(w.x2 - w.x1, w.y2 - w.y1) * 100) / 100;

                    return (
                      <g
                        key={w.id}
                        onMouseDown={(e) => handleWallMouseDown(e, w)}
                        className={w.loadBearing ? 'cursor-pointer' : 'cursor-move'}
                      >
                        {/* Невидимая широкая зона для удобного клика по тонкой перегородке */}
                        <line
                          x1={w.x1 * SCALE}
                          y1={w.y1 * SCALE}
                          x2={w.x2 * SCALE}
                          y2={w.y2 * SCALE}
                          stroke="transparent"
                          strokeWidth={Math.max(14, w.thickness * SCALE + 8)}
                        />
                        {/* Видимая стена */}
                        <line
                          x1={w.x1 * SCALE}
                          y1={w.y1 * SCALE}
                          x2={w.x2 * SCALE}
                          y2={w.y2 * SCALE}
                          stroke={strokeColor}
                          strokeWidth={Math.max(3, w.thickness * SCALE)}
                          strokeLinecap="square"
                        />
                        {/* Размер перегородки при выделении или в режиме редактора стен */}
                        {(isSelected || (viewMode === 'walls' && !w.loadBearing && lengthM >= 1.2)) && (
                          <text
                            x={((w.x1 + w.x2) / 2) * SCALE}
                            y={((w.y1 + w.y2) / 2) * SCALE - 5}
                            transform={planRotated ? `rotate(180 ${((w.x1 + w.x2) / 2) * SCALE} ${((w.y1 + w.y2) / 2) * SCALE - 5})` : undefined}
                            textAnchor="middle"
                            fontSize="10.5"
                            fontWeight="700"
                            fill={isSelected ? '#FCD116' : darkMode ? '#FCD116' : '#8E751D'}
                            className="pointer-events-none"
                          >
                            {lengthM}м
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Оконные проёмы — из проверенной модели (openings.csv) */}
                  {PLAN_WINDOWS.map((win) => (
                    <rect
                      key={win.id}
                      x={win.rect[0] * SCALE}
                      y={win.rect[1] * SCALE}
                      width={win.rect[2] * SCALE}
                      height={win.rect[3] * SCALE}
                      fill={darkMode ? '#FCD116' : '#FCD116'}
                      stroke={darkMode ? '#8E751D' : '#B9B28F'}
                      strokeWidth="1"
                      fillOpacity="0.85"
                    />
                  ))}
                </g>

                {/* 2b. ТЕКСТОВЫЙ СЛОЙ — вне групповой прозрачности, чтобы подписи были чёткими */}
                <g className="pointer-events-none" style={showDrawingPlan ? { display: 'none' } : undefined}>
                  {EXTERIOR_ENTRIES.map((ext) => {
                    const parts: any[] = Array.isArray((ext.polygon as any)[0][0]) ? (ext.polygon as any) : [ext.polygon];
                    const c = parts[0]
                      .reduce((a: number[], p: number[]) => [a[0] + p[0], a[1] + p[1]], [0, 0])
                      .map((v: number) => v / parts[0].length);
                    return (
                      <text
                        key={ext.id}
                        x={c[0] * SCALE}
                        y={c[1] * SCALE}
                        transform={planRotated ? `rotate(180 ${c[0] * SCALE} ${c[1] * SCALE})` : undefined}
                        textAnchor="middle"
                        fontSize="10.5"
                        fill={darkMode ? '#B9B28F' : '#6B6552'}
                        className="font-medium"
                      >
                        {ext.name}
                      </text>
                    );
                  })}

                  {/* Подписи помещений: № / площадь / название */}
                  {showRoomLabels &&
                    INITIAL_ROOMS.filter((r) => planFilter === 'unified' || r.premise === planFilter).map((room) => (
                      <g
                        key={`lbl-${room.id}`}
                        transform={`translate(${room.label[0] * SCALE}, ${room.label[1] * SCALE}) scale(${1 / zoom}) rotate(${planRotated ? 180 : 0})`}
                      >
                        <text x="0" y="-5" textAnchor="middle" fontSize="11" fontWeight="700"
                          fill={darkMode ? '#FFF5B8' : '#2E2C1E'}>{room.num}</text>
                        <line x1="-14" y1="-1" x2="14" y2="-1"
                          stroke={darkMode ? '#8E751D' : '#6B6552'} strokeWidth="1.2" />
                        <text x="0" y="10" textAnchor="middle" fontSize="10" fontWeight="600"
                          fill={darkMode ? '#B9B28F' : '#6B6552'}>{room.area ?? ''}</text>
                        {room.area !== null && room.area >= 7 && (
                          <text x="0" y="21" textAnchor="middle" fontSize="9.5"
                            fill={darkMode ? '#8F8A6E' : '#B9B28F'}>{room.name}</text>
                        )}
                      </g>
                    ))}

                  {/* Внешние размерные цепочки — реальные габариты проверенной модели */}
                  {showDimensions && (
                    <g className="pointer-events-none" fill={darkMode ? '#8F8A6E' : '#6B6552'} fontSize="10.5">
                      <line
                        x1={0}
                        y1={(BUILDING.depth + 0.9) * SCALE}
                        x2={BUILDING.width * SCALE}
                        y2={(BUILDING.depth + 0.9) * SCALE}
                        stroke={darkMode ? '#2E2C1E' : '#E6E0C2'}
                        strokeWidth="1"
                        strokeDasharray="3,3"
                      />
                      <text
                        x={(BUILDING.width / 2) * SCALE}
                        y={(BUILDING.depth + 1.35) * SCALE}
                        transform={planRotated ? `rotate(180 ${(BUILDING.width / 2) * SCALE} ${(BUILDING.depth + 1.35) * SCALE})` : undefined}
                        textAnchor="middle"
                        fontWeight="600"
                      >
                        Общая длина здания: {BUILDING.width} м (пом. 1080 + пом. 1079)
                      </text>
                      <text
                        x={-0.7 * SCALE}
                        y={(BUILDING.depth / 2) * SCALE}
                        textAnchor="middle"
                        transform={`${planRotated ? `rotate(180, ${-0.7 * SCALE}, ${(BUILDING.depth / 2) * SCALE}) ` : ''}rotate(-90, ${-0.7 * SCALE}, ${(BUILDING.depth / 2) * SCALE})`}
                        fontWeight="600"
                      >
                        Глубина: {BUILDING.depth} м
                      </text>
                    </g>
                  )}

                </g>

                {/* 3. ТЕПЛОВАЯ КАРТА ПОКРЫТИЯ WI-FI (РАДИУСЫ ТОЧЕК ДОСТУПА AP) */}
                {showWifiHeatmap &&
                  nodes
                    .filter((n) => n.type === 'wifi')
                    .map((ap) => {
                      const layerVisible = layers.find((l) => l.id === ap.layer)?.visible;
                      if (!layerVisible) return null;
                      const rPx = (ap.radius || 7.5) * SCALE;
                      return (
                        <g key={`wifi-${ap.id}`} className="pointer-events-none">
                          <circle
                            cx={ap.x * SCALE}
                            cy={ap.y * SCALE}
                            r={rPx}
                            fill="url(#wifiGradient)"
                            stroke="#34D399"
                            strokeWidth="1"
                            strokeDasharray="4,4"
                            strokeOpacity="0.45"
                          />
                        </g>
                      );
                    })}

                {/* 4. СЛОЙ КАБЕЛЬНЫХ ТРАСС (ОРТОГОНАЛЬНЫЕ И ПРЯМЫЕ ЛИНИИ) */}
                {cables.map((cab) => {
                  const cType = CABLE_TYPES.find((t) => t.id === cab.cableType) || CABLE_TYPES[0];
                  const layerObj = layers.find((l) => l.id === cType.layer);
                  if (layerObj && !layerObj.visible) return null;

                  const metrics = computeCableMetrics(cab);
                  if (!metrics.points) return null;
                  const isSelected = Selection?.type === 'cable' && Selection?.id === cab.id;

                  // Середина трассы для бейджа метража
                  const midPoint =
                    metrics.pathPoints.length >= 2
                      ? metrics.pathPoints[1]
                      : { x: 0, y: 0 };

                  return (
                    <g
                      key={cab.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelection({ type: 'cable', id: cab.id });
                      }}
                      className="cursor-pointer group"
                    >
                      {/* Широкая прозрачная подложка для удобного клика по кабелю */}
                      <polyline
                        points={metrics.points}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="12"
                      />
                      {/* Подсветка при выделении */}
                      {isSelected && (
                        <polyline
                          points={metrics.points}
                          fill="none"
                          stroke="#8E751D"
                          strokeWidth="6"
                          strokeOpacity="0.35"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                      {/* Сама линия кабеля */}
                      <polyline
                        points={metrics.points}
                        fill="none"
                        stroke={cType.color}
                        strokeWidth={isSelected ? '3.2' : '2.2'}
                        strokeDasharray={cType.dashed ? '6,4' : undefined}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Метка длины на выбранном кабеле */}
                      {isSelected && (
                        <g transform={`translate(${midPoint.x}, ${midPoint.y}) rotate(${planRotated ? 180 : 0})`}>
                          <rect
                            x="-28"
                            y="-10"
                            width="56"
                            height="18"
                            rx="5"
                            fill="#26251D"
                            stroke={cType.color}
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="2"
                            textAnchor="middle"
                            fontSize="10.5"
                            fontWeight="700"
                            fill="#ffffff"
                          >
                            {metrics.totalLengthM} м
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Предпросмотр рисуемой стены */}
                {wallDraft && (
                  <line
                    x1={wallDraft.x1 * SCALE}
                    y1={wallDraft.y1 * SCALE}
                    x2={wallDraft.x2 * SCALE}
                    y2={wallDraft.y2 * SCALE}
                    stroke="#FCD116"
                    strokeWidth={0.12 * SCALE}
                    strokeDasharray="4,2"
                  />
                )}

                {/* Инструмент Линейка / Замер */}
                {rulerPoints && (
                  <g className="pointer-events-none">
                    <line
                      x1={rulerPoints.x1 * SCALE}
                      y1={rulerPoints.y1 * SCALE}
                      x2={rulerPoints.x2 * SCALE}
                      y2={rulerPoints.y2 * SCALE}
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeDasharray="5,3"
                    />
                    <circle cx={rulerPoints.x1 * SCALE} cy={rulerPoints.y1 * SCALE} r="4" fill="#f59e0b" />
                    <circle cx={rulerPoints.x2 * SCALE} cy={rulerPoints.y2 * SCALE} r="4" fill="#f59e0b" />
                    <g
                      transform={`translate(${((rulerPoints.x1 + rulerPoints.x2) / 2) * SCALE}, ${
                        ((rulerPoints.y1 + rulerPoints.y2) / 2) * SCALE - 10
                      }) rotate(${planRotated ? 180 : 0})`}
                    >
                      <rect x="-36" y="-12" width="72" height="20" rx="6" fill="#f59e0b" />
                      <text x="0" y="2" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#fff">
                        {Math.round(Math.hypot(rulerPoints.x2 - rulerPoints.x1, rulerPoints.y2 - rulerPoints.y1) * 100) /
                          100}{' '}
                        м
                      </text>
                    </g>
                  </g>
                )}

                {/* 5. СЛОЙ ТЕКСТОВЫХ ПОМЕТОК */}
                {layers.find((l) => l.id === 'notes')?.visible &&
                  notes.map((nt) => {
                    const isSelected = Selection?.type === 'note' && Selection?.id === nt.id;
                    return (
                      <g
                        key={nt.id}
                        transform={`translate(${nt.x * SCALE}, ${nt.y * SCALE}) rotate(${planRotated ? 180 : 0})`}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setSelection({ type: 'note', id: nt.id });
                          setDraggingItem({ type: 'note', id: nt.id });
                        }}
                        className="cursor-move"
                      >
                        <rect
                          x="-4"
                          y="-13"
                          width={nt.text.length * 6.2 + 12}
                          height="20"
                          rx="5"
                          fill={darkMode ? '#26251D' : '#FFF8D6'}
                          stroke={isSelected ? '#FCD116' : '#E3BC0E'}
                          strokeWidth={isSelected ? '2' : '1'}
                        />
                        <text
                          x="2"
                          y="1"
                          fontSize="10.5"
                          fontWeight="600"
                          fill={darkMode ? '#FCD116' : '#854d0e'}
                        >
                          {nt.text}
                        </text>
                      </g>
                    );
                  })}

                {/* 6. СЛОЙ УЗЛОВ ОБОРУДОВАНИЯ (РОУТЕРЫ, КОММУТАТОРЫ, ТОЧКИ WI-FI, ПК, КАМЕРЫ) */}
                {nodes.map((node) => {
                  const layerObj = layers.find((l) => l.id === node.layer);
                  if (layerObj && !layerObj.visible) return null;

                  const isSelected = Selection?.type === 'node' && Selection?.id === node.id;
                  const isCableStart = cableStartNodeId === node.id;
                  const color = layerObj?.color || '#FCD116';

                  const catItem = EQUIPMENT_CATALOG.flatMap((g) => g.items).find(
                    (i) => i.type === node.type
                  );

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x * SCALE}, ${node.y * SCALE})`}
                      onMouseDown={(e) => handleNodeMouseDown(e, node)}
                      className="cursor-pointer group"
                    >
                      {/* Пульсирующий ореол при выделении или начале кабеля */}
                      {(isSelected || isCableStart) && (
                        <circle
                          r="19"
                          fill="none"
                          stroke={isCableStart ? '#34D399' : '#FCD116'}
                          strokeWidth="2.5"
                          strokeDasharray={isCableStart ? '4,2' : undefined}
                        />
                      )}

                      {/* Круглый корпус узла в стиле UniFi Design Center */}
                      <circle
                        r="13.5"
                        fill={darkMode ? '#09090A' : '#ffffff'}
                        stroke={color}
                        strokeWidth={isSelected ? '3' : '2.2'}
                      />

                      {/* Внутренняя векторная пиктограмма */}
                      <foreignObject x="-8" y="-8" width="16" height="16" className="pointer-events-none">
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ color }}
                        >
                          <RenderNodeIcon iconName={catItem?.icon || 'Cpu'} className="w-3.5 h-3.5" />
                        </div>
                      </foreignObject>

                      {/* Аккуратная подпись кода узла (не перекрывающая чертёж) */}
                      <g transform={`translate(0, 22) scale(${1 / zoom}) rotate(${planRotated ? 180 : 0})`} className="pointer-events-none">
                        <rect
                          x="-25"
                          y="-9"
                          width="50"
                          height="14"
                          rx="4"
                          fill={darkMode ? 'rgba(15,23,42,0.88)' : 'rgba(255,255,255,0.92)'}
                          stroke={isSelected ? '#FCD116' : 'rgba(148,163,184,0.4)'}
                          strokeWidth="0.8"
                        />
                        <text
                          x="0"
                          y="0.5"
                          textAnchor="middle"
                          fontSize="10.5"
                          fontWeight="700"
                          fill={darkMode ? '#FFF8D6' : '#26251D'}
                        >
                          {node.code}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Курсоры коллег в реальном времени */}
            {collab.mode !== 'demo' && (
              <RemoteCursors
                users={collab.users}
                me={collab.user}
                pan={pan}
                zoom={zoom}
                rotated={planRotated}
                centerPx={{ x: ROT_CX, y: ROT_CY }}
              />
            )}

            {/* Лента совместной работы */}
            {collab.mode !== 'demo' && <ActivityFeed items={activity} />}

            {/* НИЖНИЙ СТАТУС-БАР СЛЕВА (Координаты в метрах, текущий инструмент и подсказки) */}
            <div
              className={`absolute bottom-3 left-3 z-20 px-3 py-1.5 rounded-xl border backdrop-blur-md text-[11px] flex items-center gap-3 shadow-sm ${
                darkMode
                  ? 'bg-slate-900/90 border-slate-800 text-slate-300'
                  : 'bg-white/90 border-slate-200/90 text-slate-600'
              }`}
            >
              <span className="flex items-center gap-1.5 font-semibold text-blue-600 dark:text-blue-400">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                X: {mouseMeters.x.toFixed(2)} м, Y: {mouseMeters.y.toFixed(2)} м
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="hidden sm:inline truncate max-w-52">
                {getRoomForPoint(mouseMeters.x, mouseMeters.y)}
              </span>
              <span className="text-slate-300 dark:text-slate-700 hidden md:inline">|</span>
              <span className="hidden md:inline text-slate-400">
                Колесо — зум • Зажать ЛКМ/Пробел — панорама • Del — удалить
              </span>
              {netReadOnly && (
                <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-medium">
                  Режим инженера: сеть только для просмотра
                </span>
              )}
            </div>

            {/* НИЖНИЙ ПРАВЫЙ ДОК МАСШТАБА И СЕТКИ */}
            <div
              className={`absolute bottom-3 right-3 z-20 p-1 rounded-xl border backdrop-blur-md flex items-center gap-1 shadow-sm ${
                darkMode
                  ? 'bg-slate-900/90 border-slate-800 text-slate-200'
                  : 'bg-white/90 border-slate-200/90 text-slate-700'
              }`}
            >
              <button
                onClick={() => setPlanRotated((v) => !v)}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  planRotated ? 'bg-blue-600/15 text-blue-600 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Перевернуть чертёж на 180° (R)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                  showGrid ? 'bg-blue-600/15 text-blue-600 font-semibold' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Показать / скрыть метрическую сетку (1х1 м)"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5" />
              <button
                onClick={() => setZoom((z) => Math.max(0.35, Math.round((z - 0.1) * 100) / 100))}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Отдалить"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-semibold px-1.5 min-w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(2.4, Math.round((z + 0.1) * 100) / 100))}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Приблизить"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleFitView}
                className="px-2 py-1 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                title="Вписать чертёж в экран"
              >
                Вписать
              </button>
            </div>
          </main>

          {/* =================================================================
              4. ПРАВАЯ УМНАЯ ПАНЕЛЬ (СЛОИ + КОНТЕКСТНЫЙ ИНСПЕКТОР СВОЙСТВ)
          ================================================================= */}
          <aside
            className={`w-[350px] border-l flex flex-col z-20 shrink-0 ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90'
            }`}
          >
            {/* ВЕРХНЯЯ ЧАСТЬ: СЛОИ (СОВМЕЩЁННЫЕ С ЛЕГЕНДОЙ И СЧЁТЧИКОМ) */}
            <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[48%]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">Слои и Легенда</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setLayers((prev) => prev.map((l) => ({ ...l, visible: l.id === activeLayerId })))
                    }
                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Оставить видимым только выбранный слой"
                  >
                    Только актив.
                  </button>
                  <button
                    onClick={() => setLayers((prev) => prev.map((l) => ({ ...l, visible: true })))}
                    className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Все
                  </button>
                </div>
              </div>

              {/* Список слоев */}
              <div className="overflow-y-auto space-y-1 pr-0.5">
                {layers.map((layer) => {
                  const isActive = activeLayerId === layer.id;
                  const count = layerCounts[layer.id] || 0;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => setActiveLayerId(layer.id)}
                      className={`flex items-center justify-between px-2 py-1.5 rounded-xl border text-xs transition cursor-pointer ${
                        isActive
                          ? 'bg-blue-600/10 border-blue-500/40 font-semibold'
                          : darkMode
                          ? 'border-transparent hover:bg-slate-800/70'
                          : 'border-transparent hover:bg-slate-50'
                      } ${!layer.visible ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Видимость слоя */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLayers((prev) =>
                              prev.map((l) => (l.id === layer.id ? { ...l, visible: !l.visible } : l))
                            );
                          }}
                          className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
                          title={layer.visible ? 'Скрыть слой' : 'Показать слой'}
                        >
                          {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>

                        {/* Блокировка слоя */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLayers((prev) =>
                              prev.map((l) => (l.id === layer.id ? { ...l, locked: !l.locked } : l))
                            );
                          }}
                          className={`p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
                            layer.locked ? 'text-amber-500' : 'text-slate-400'
                          }`}
                          title={layer.locked ? 'Разблокировать слой' : 'Заблокировать от сдвига'}
                        >
                          {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </button>

                        {/* Цветовой маркер легенды */}
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: layer.color }}
                        />

                        <span className="truncate">{layer.name}</span>
                      </div>

                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                          darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* НИЖНЯЯ ЧАСТЬ: КОНТЕКСТНЫЙ ИНСПЕКТОР ОБЪЕКТА (ИЛИ СВОДКА ПРОЕКТА) */}
            <div className="flex-1 overflow-y-auto p-3.5">
              {Selection.type === 'node' && selectedObject ? (
                /* ИНСПЕКТОР ВЫБРАННОГО УЗЛА ОБОРУДОВАНИЯ */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      Паспорт узла • {selectedObject.code}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDuplicateNode(selectedObject)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                        title="Дублировать узел"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleDeleteSelected}
                        className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500"
                        title="Удалить узел (Del)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {netReadOnly && (
                    <div className="mb-2 text-[10px] px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
                      Роль «инженер»: сеть только для просмотра — редактирование стен и пометок доступно.
                    </div>
                  )}

                  <div className={`space-y-2.5 text-xs ${netReadOnly ? 'net-readonly' : ''}`}>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="text-[10px] font-semibold text-slate-400">Маркировка</label>
                        <input
                          type="text"
                          value={selectedObject.code}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) => (n.id === selectedObject.id ? { ...n, code: e.target.value } : n))
                            )
                          }
                          className={`w-full mt-0.5 px-2 py-1.5 rounded-lg border font-bold ${
                            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-semibold text-slate-400">Наименование</label>
                        <input
                          type="text"
                          value={selectedObject.name}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) => (n.id === selectedObject.id ? { ...n, name: e.target.value } : n))
                            )
                          }
                          className={`w-full mt-0.5 px-2 py-1.5 rounded-lg border ${
                            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">Модель оборудования</label>
                      <input
                        type="text"
                        value={selectedObject.model || ''}
                        onChange={(e) =>
                          setNodes((prev) =>
                            prev.map((n) => (n.id === selectedObject.id ? { ...n, model: e.target.value } : n))
                          )
                        }
                        className={`w-full mt-0.5 px-2.5 py-1.5 rounded-lg border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">IP-адрес</label>
                        <input
                          type="text"
                          value={selectedObject.ip || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) => (n.id === selectedObject.id ? { ...n, ip: e.target.value } : n))
                            )
                          }
                          className={`w-full mt-0.5 px-2 py-1.5 rounded-lg border font-mono ${
                            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">VLAN / Сеть</label>
                        <input
                          type="text"
                          value={selectedObject.vlan || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) => (n.id === selectedObject.id ? { ...n, vlan: e.target.value } : n))
                            )
                          }
                          className={`w-full mt-0.5 px-2 py-1.5 rounded-lg border font-mono ${
                            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Порт коммутатора</label>
                        <input
                          type="text"
                          value={selectedObject.port || ''}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) => (n.id === selectedObject.id ? { ...n, port: e.target.value } : n))
                            )
                          }
                          className={`w-full mt-0.5 px-2 py-1.5 rounded-lg border font-mono ${
                            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Высота монтажа (м)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={selectedObject.heightM ?? 0.8}
                          onChange={(e) =>
                            setNodes((prev) =>
                              prev.map((n) =>
                                n.id === selectedObject.id ? { ...n, heightM: Number(e.target.value) } : n
                              )
                            )
                          }
                          className={`w-full mt-0.5 px-2 py-1.5 rounded-lg border ${
                            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Автоопределение помещения по координатам */}
                    <div
                      className={`p-2.5 rounded-xl border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400">Привязка к помещению (авто):</div>
                      <div className="font-semibold mt-0.5">
                        {getRoomForPoint(selectedObject.x, selectedObject.y)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Координаты: X = {selectedObject.x} м, Y = {selectedObject.y} м
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setActiveTool('cable');
                        setCableStartNodeId(selectedObject.id);
                        triggerToast(`Выберите второй узел для соединения с ${selectedObject.code}`);
                      }}
                      disabled={netReadOnly}
                      className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-2 shadow-2xs transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Cable className="w-3.5 h-3.5" />
                      <span>{netReadOnly ? 'Сеть: только просмотр' : 'Проложить кабель от этого узла'}</span>
                    </button>
                  </div>
                </div>
              ) : Selection.type === 'cable' && selectedObject ? (
                /* ИНСПЕКТОР ВЫБРАННОЙ КАБЕЛЬНОЙ ТРАССЫ */
                (() => {
                  const m = computeCableMetrics(selectedObject);
                  const n1 = nodes.find((n) => n.id === selectedObject.from);
                  const n2 = nodes.find((n) => n.id === selectedObject.to);
                  return (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                          Кабельная трасса
                        </span>
                        <button
                          onClick={handleDeleteSelected}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"
                          title="Удалить трассу"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div
                        className={`p-3 rounded-xl border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-blue-50/50 border-blue-200/70'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span>{n1?.code || 'Узел 1'}</span>
                          <span className="text-blue-600">→</span>
                          <span>{n2?.code || 'Узел 2'}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-baseline justify-between">
                          <span className="text-slate-400">Расчётная длина бухты:</span>
                          <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                            {m.totalLengthM} м
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          По горизонту: {m.lengthPlanM} м + опуски с потолка (h=3.96м) + 12% запас
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Тип кабеля</label>
                        <select
                          value={selectedObject.cableType}
                          onChange={(e) =>
                            setCables((prev) =>
                              prev.map((c) =>
                                c.id === selectedObject.id ? { ...c, cableType: e.target.value } : c
                              )
                            )
                          }
                          className={`w-full mt-1 px-2.5 py-1.5 rounded-lg border ${
                            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          {CABLE_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Геометрия трассы в лотке</label>
                        <div className="grid grid-cols-3 gap-1.5 mt-1">
                          {[
                            { id: 'ortho-hv', label: 'Г-образно (X→Y)' },
                            { id: 'ortho-vh', label: 'Г-образно (Y→X)' },
                            { id: 'direct', label: 'Напрямую' },
                          ].map((rm) => (
                            <button
                              key={rm.id}
                              onClick={() =>
                                setCables((prev) =>
                                  prev.map((c) =>
                                    c.id === selectedObject.id ? { ...c, routeMode: rm.id } : c
                                  )
                                )
                              }
                              className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                                selectedObject.routeMode === rm.id
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : darkMode
                                  ? 'bg-slate-800 border-slate-700'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              {rm.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : Selection.type === 'wall' && selectedObject ? (
                /* ИНСПЕКТОР ВЫБРАННОЙ СТЕНЫ ИЛИ ПЕРЕГОРОДКИ */
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                      Конструкция стены
                    </span>
                    {!selectedObject.loadBearing && (
                      <button
                        onClick={handleDeleteSelected}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"
                        title="Демонтировать перегородку"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div
                    className={`p-3 rounded-xl border ${
                      selectedObject.loadBearing
                        ? darkMode
                          ? 'bg-amber-950/30 border-amber-800/50'
                          : 'bg-amber-50 border-amber-200'
                        : darkMode
                        ? 'bg-slate-950 border-slate-800'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="font-bold">{selectedObject.name}</div>
                    <div className="text-[11px] mt-1 text-slate-500">
                      Тип:{' '}
                      <strong>
                        {selectedObject.loadBearing
                          ? 'Капитальная / Несущая (защищена)'
                          : 'Перегородка (редактируемая)'}
                      </strong>
                    </div>
                    <div className="text-[11px] mt-0.5 text-slate-500">
                      Длина:{' '}
                      <strong>
                        {Math.round(
                          Math.hypot(selectedObject.x2 - selectedObject.x1, selectedObject.y2 - selectedObject.y1) * 100
                        ) / 100}{' '}
                        м
                      </strong>{' '}
                      • Толщина: <strong>{selectedObject.thickness} м</strong>
                    </div>
                  </div>
                </div>
              ) : (
                /* СВОДКА ПРОЕКТА (КОГДА НИЧЕГО НЕ ВЫДЕЛЕНО) */
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Сводка по объекту
                    </span>
                    <span className="text-[11px] font-semibold text-blue-600">Козина, 7</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={`p-2.5 rounded-xl border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400">Активных узлов</div>
                      <div className="text-base font-bold mt-0.5">{nodes.length} ед.</div>
                    </div>
                    <div
                      className={`p-2.5 rounded-xl border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                      }`}
                    >
                      <div className="text-[10px] text-slate-400">Кабельных трасс</div>
                      <div className="text-base font-bold text-blue-600 mt-0.5">
                        {cableSummary.grandTotalMeters} м
                      </div>
                    </div>
                  </div>

                  {/* Расход кабеля по типам */}
                  <div
                    className={`p-3 rounded-xl border space-y-2 ${
                      darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50/70 border-slate-200/80'
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      Метраж кабеля по слоям
                    </div>
                    {cableSummary.list.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="truncate">{c.short}</span>
                        </span>
                        <span className="font-mono font-semibold">
                          {c.totalMeters} м ({c.count})
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setViewMode('bom')}
                    className="w-full py-2 px-3 rounded-xl border border-blue-600/30 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Открыть кабельный журнал</span>
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
      {showPassword && (
        <PasswordDialog
          onClose={() => setShowPassword(false)}
          onSave={async (oldPass, newPass) => {
            await collab.changePassword(oldPass, newPass);
            setShowPassword(false);
            collab.logout();
          }}
        />
      )}
    </div>
  );
}

