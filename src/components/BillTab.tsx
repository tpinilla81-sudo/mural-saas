"use client";

import { useState } from "react";
import { BillConfigProvider, useBillConfig } from "@/lib/bill-config";
import { EntradaView } from "@/components/bill/entrada-view";
import { RegistrosView } from "@/components/bill/registros-view";
import { ClientesView } from "@/components/bill/clientes-view";
import { CatalogoView } from "@/components/bill/catalogo-view";
import { FacturasView } from "@/components/bill/facturas-view";
import { ConfiguracionView } from "@/components/bill/configuracion-view";
import {
  FileInput,
  Table2,
  Users,
  BookOpen,
  Receipt,
  Settings,
} from "lucide-react";

type BillTabKey =
  | "entrada"
  | "registros"
  | "clientes"
  | "catalogo"
  | "facturas"
  | "config";

const NAV_ITEMS: {
  key: BillTabKey;
  label: string;
  icon: React.ReactNode;
  color: string;
  configKey?: string;
}[] = [
  {
    key: "entrada",
    label: "ENTRADA",
    icon: <FileInput className="h-4 w-4" />,
    color: "text-green-600",
    configKey: "sectionEntrada",
  },
  {
    key: "registros",
    label: "REGISTROS",
    icon: <Table2 className="h-4 w-4" />,
    color: "text-blue-600",
    configKey: "sectionRegistros",
  },
  {
    key: "clientes",
    label: "CLIENTES",
    icon: <Users className="h-4 w-4" />,
    color: "text-purple-600",
    configKey: "sectionClientes",
  },
  {
    key: "catalogo",
    label: "CATÁLOGO",
    icon: <BookOpen className="h-4 w-4" />,
    color: "text-amber-600",
    configKey: "sectionCatalogo",
  },
  {
    key: "facturas",
    label: "FACTURAS",
    icon: <Receipt className="h-4 w-4" />,
    color: "text-rose-600",
    configKey: "sectionFacturas",
  },
  {
    key: "config",
    label: "CONFIGURACIÓN",
    icon: <Settings className="h-4 w-4" />,
    color: "text-gray-500",
  },
];

function BillTabContent() {
  const [activeTab, setActiveTab] = useState<BillTabKey>("entrada");
  const { config } = useBillConfig();

  function getLabel(item: (typeof NAV_ITEMS)[number]): string {
    if (!item.configKey || !config) return item.label;
    const val = config[item.configKey as keyof typeof config];
    return typeof val === "string" ? val : item.label;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Navigation tabs */}
      <div className="flex-shrink-0 border-b bg-[#1a1a1a]">
        <div className="flex overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === item.key
                  ? `${item.color} bg-white/10 border-b-[#2bb24c]`
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/5 border-b-transparent"
              }`}
            >
              {item.icon}
              {getLabel(item)}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 p-4 overflow-auto">
        {activeTab === "entrada" && <EntradaView />}
        {activeTab === "registros" && <RegistrosView />}
        {activeTab === "clientes" && <ClientesView />}
        {activeTab === "catalogo" && <CatalogoView />}
        {activeTab === "facturas" && <FacturasView />}
        {activeTab === "config" && <ConfiguracionView />}
      </div>
    </div>
  );
}

export default function BillTab() {
  return (
    <BillConfigProvider>
      <BillTabContent />
    </BillConfigProvider>
  );
}
