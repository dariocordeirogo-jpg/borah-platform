/**
 * DADOS DE DEMONSTRAÇÃO — Fase 1.
 * Nada aqui é um leilão, produto, loja ou preço real. A interface marca tudo como demonstração.
 * Na Fase 2/3 isto é substituído por consultas ao banco.
 */
import type { LucideIcon } from "lucide-react";
import {
  Bike,
  Coffee,
  Footprints,
  Gamepad2,
  Hammer,
  Headphones,
  Smartphone,
  Watch,
  Sofa,
  Shirt,
  Car,
  Sparkles,
  Dumbbell,
  Baby,
  BookOpen,
  Gem,
  Laptop,
  Store,
} from "lucide-react";

export type DemoAuction = {
  id: string;
  title: string;
  icon: LucideIcon;
  category: string;
  currentBidCents: number;
  minIncrementCents: number;
  bids: number;
  endsInSeconds: number;
  live?: { viewers: number; host: string };
};

export type DemoUpcoming = {
  id: string;
  title: string;
  icon: LucideIcon;
  startPriceCents: number;
  startsInSeconds: number;
  seller: string;
};

export type DemoProduct = {
  id: string;
  title: string;
  icon: LucideIcon;
  priceCents: number;
  oldPriceCents?: number;
  installments: number;
};

export const categories: { slug: string; name: string; icon: LucideIcon }[] = [
  { slug: "eletronicos", name: "Eletrônicos", icon: Headphones },
  { slug: "celulares", name: "Celulares", icon: Smartphone },
  { slug: "informatica", name: "Informática", icon: Laptop },
  { slug: "casa", name: "Casa", icon: Sofa },
  { slug: "moda", name: "Moda", icon: Shirt },
  { slug: "beleza", name: "Beleza", icon: Sparkles },
  { slug: "esportes", name: "Esportes", icon: Dumbbell },
  { slug: "automotivo", name: "Automotivo", icon: Car },
  { slug: "ferramentas", name: "Ferramentas", icon: Hammer },
  { slug: "brinquedos", name: "Brinquedos", icon: Baby },
  { slug: "livros", name: "Livros", icon: BookOpen },
  { slug: "colecionaveis", name: "Colecionáveis", icon: Gem },
];

export const liveAuctions: DemoAuction[] = [
  {
    id: "demo-live-1",
    title: "Fone de ouvido sem fio com cancelamento de ruído",
    icon: Headphones,
    category: "Eletrônicos",
    currentBidCents: 38000,
    minIncrementCents: 1000,
    bids: 27,
    endsInSeconds: 155,
    live: { viewers: 1284, host: "Loja Exemplo Som" },
  },
  {
    id: "demo-live-2",
    title: "Console portátil 64 GB",
    icon: Gamepad2,
    category: "Eletrônicos",
    currentBidCents: 129000,
    minIncrementCents: 2500,
    bids: 41,
    endsInSeconds: 420,
    live: { viewers: 3410, host: "Games Exemplo" },
  },
];

export const endingSoon: DemoAuction[] = [
  {
    id: "demo-end-1",
    title: "Smartphone 128 GB, tela 6,5\"",
    icon: Smartphone,
    category: "Celulares",
    currentBidCents: 92000,
    minIncrementCents: 2000,
    bids: 34,
    endsInSeconds: 540,
  },
  {
    id: "demo-end-2",
    title: "Relógio inteligente com GPS",
    icon: Watch,
    category: "Eletrônicos",
    currentBidCents: 31500,
    minIncrementCents: 1000,
    bids: 19,
    endsInSeconds: 1320,
  },
  {
    id: "demo-end-3",
    title: "Bicicleta aro 29, 21 marchas",
    icon: Bike,
    category: "Esportes",
    currentBidCents: 74000,
    minIncrementCents: 2000,
    bids: 12,
    endsInSeconds: 2700,
  },
  {
    id: "demo-end-4",
    title: "Furadeira de impacto 750 W",
    icon: Hammer,
    category: "Ferramentas",
    currentBidCents: 18900,
    minIncrementCents: 500,
    bids: 8,
    endsInSeconds: 5400,
  },
];

export const upcoming: DemoUpcoming[] = [
  { id: "demo-up-1", title: "Cafeteira expresso automática", icon: Coffee, startPriceCents: 9900, startsInSeconds: 7200, seller: "Casa Exemplo" },
  { id: "demo-up-2", title: "Tênis de corrida, numeração 34–44", icon: Footprints, startPriceCents: 4900, startsInSeconds: 86400, seller: "Esporte Exemplo" },
  { id: "demo-up-3", title: "Notebook 16 GB RAM, SSD 512 GB", icon: Laptop, startPriceCents: 150000, startsInSeconds: 172800, seller: "Tech Exemplo" },
];

export const offers: DemoProduct[] = [
  { id: "demo-p-1", title: "Caixa de som portátil à prova d'água", icon: Headphones, priceCents: 19990, oldPriceCents: 26990, installments: 10 },
  { id: "demo-p-2", title: "Jogo de panelas antiaderente, 5 peças", icon: Coffee, priceCents: 24990, installments: 10 },
  { id: "demo-p-3", title: "Mochila para notebook até 15,6\"", icon: Laptop, priceCents: 12990, oldPriceCents: 15990, installments: 6 },
  { id: "demo-p-4", title: "Camiseta dry-fit, kit com 3", icon: Shirt, priceCents: 8990, installments: 3 },
  { id: "demo-p-5", title: "Kit de ferramentas, 110 peças", icon: Hammer, priceCents: 17990, oldPriceCents: 21990, installments: 10 },
];

export const stores: { id: string; name: string; tagline: string; icon: LucideIcon }[] = [
  { id: "demo-s-1", name: "Loja Exemplo Som", tagline: "Áudio e acessórios", icon: Headphones },
  { id: "demo-s-2", name: "Casa Exemplo", tagline: "Cozinha e decoração", icon: Sofa },
  { id: "demo-s-3", name: "Esporte Exemplo", tagline: "Corrida e academia", icon: Dumbbell },
  { id: "demo-s-4", name: "Tech Exemplo", tagline: "Informática", icon: Store },
];
