
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { registroGastosTransporte } from '@/services/registroGastosTransporte.service';
import { Loader2, Calendar as CalendarIcon, Package, CheckCircle2, Clock, ChevronDown, FileDown, RotateCcw, ChevronLeft, ChevronRight, Filter, FileSpreadsheet, Search, ReceiptText, X, Hash } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import jspdf from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';

interface RegistroFactura {
  id: string;
  numeroRegistro: string;
  codigoProveedor: string;
  numeroFactura: string;
  valorTotal: number;
  fechaRegistro: string;
  estado: string;
  numeroGasto: string;
  transporte: string;
}

interface GrupoDashboard {
  keyFactura: string;
  codigoProveedor: string;
  numeroFactura: string;
  fechaRegistro: string;
  estado: string;
  valorTotalAcumulado: number;
  items: RegistroFactura[];
}

const FISICOS_STORAGE_KEY = 'RGT_ENTREGADOS_FISICOS';

export default function DashboardPage() {
  const [registros, setRegistros] = useState<RegistroFactura[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [entregadosFisicos, setEntregadosFisicos] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("PENDIENTE");
  const [invoiceFilter, setInvoiceFilter] = useState<string>("");
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const proveedorId = String(user?.usuario || user?.codigo_usuario || '');

      // Usando getAll como se solicitó para recuperar las facturas registradas
      const resp = await registroGastosTransporte.getAll();
      const rawData = resp.data || [];
      
      const mappedData: RegistroFactura[] = rawData.map((item: any, idx: number) => {
        // Mapeo robusto de valores para evitar totales en cero
        const val = item.ValorGasto ?? item.valorGasto ?? item.VALOR ?? item.valor ?? item.Monto ?? item.monto ?? item.valor_gasto ?? 0;
        const gasto = item.GastoTransporte || item.numGasto || item.NumGasto || item.Gasto || item.gasto || 'N/A';
        
        return {
          id: String(item.id || idx),
          numeroRegistro: item.NumFactura || 'N/A',
          codigoProveedor: String(item.AgenteTransporte || proveedorId),
          numeroFactura: item.NumFactura || '',
          valorTotal: Number(val) || 0,
          fechaRegistro: item.FechaRegistro || new Date().toISOString(),
          estado: item.Estado || 'A',
          numeroGasto: String(gasto),
          transporte: item.Transporte || 'N/A'
        };
      });

      // Filtrado opcional por transportista si es necesario (el dashboard suele ser personal)
      const dataForUser = mappedData.filter(reg => 
        !proveedorId || String(reg.codigoProveedor) === proveedorId
      );

      setRegistros(dataForUser);

      const storedFisicos = localStorage.getItem(FISICOS_STORAGE_KEY);
      if (storedFisicos) {
        try {
          setEntregadosFisicos(new Set(JSON.parse(storedFisicos)));
        } catch (e) {
          console.error("Error parsing fisicos storage", e);
        }
      }
    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatInvoice = (val: string) => {
    if (!val) return 'N/A';
    if (val.includes('-')) return val;
    const clean = val.replace(/\D/g, '');
    if (clean.length >= 13) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    if (clean.length > 3) {
      return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    }
    return clean;
  };

  const toggleRow = (key: string) => {
    const next = new Set(expandedRows);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedRows(next);
  };

  const groupedRegistros = useMemo(() => {
    const groups: Record<string, GrupoDashboard> = {};
    
    const baseFiltrada = registros.filter(reg => {
      let matchesInvoice = true;
      if (invoiceFilter.trim()) {
        const cleanInvoice = invoiceFilter.toLowerCase().replace(/-/g, '');
        matchesInvoice = reg.numeroFactura.toLowerCase().includes(cleanInvoice);
      }
      
      let matchesDate = true;
      if (dateRange?.from && dateRange?.to) {
        const d = new Date(reg.fechaRegistro);
        matchesDate = d >= startOfDay(dateRange.from) && d <= endOfDay(dateRange.to);
      }

      return matchesInvoice && matchesDate;
    });

    baseFiltrada.forEach(reg => {
      const key = reg.numeroFactura; 
      if (!groups[key]) {
        groups[key] = {
          keyFactura: key,
          codigoProveedor: reg.codigoProveedor,
          numeroFactura: reg.numeroFactura,
          fechaRegistro: reg.fechaRegistro,
          estado: reg.estado,
          valorTotalAcumulado: 0,
          items: []
        };
      }
      groups[key].items.push(reg);
      groups[key].valorTotalAcumulado += reg.valorTotal;
    });

    return Object.values(groups).filter(grupo => {
      const isEntregado = entregadosFisicos.has(grupo.keyFactura);
      if (statusFilter === "ENTREGADO") return isEntregado;
      if (statusFilter === "PENDIENTE") return !isEntregado;
      return true;
    }).sort((a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());
  }, [registros, statusFilter, invoiceFilter, entregadosFisicos, dateRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, statusFilter, invoiceFilter]);

  const pagedGroups = useMemo(() => {
    const start = (currentPage - 1) * 50;
    const end = start + 50;
    return groupedRegistros.slice(start, end);
  }, [groupedRegistros, currentPage]);

  const totalPages = Math.ceil(groupedRegistros.length / 50) || 1;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allItemIds = groupedRegistros.flatMap(g => g.items.map(i => i.id));
      setSelectedIds(new Set(allItemIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectGroup = (items: RegistroFactura[], checked: boolean) => {
    const next = new Set(selectedIds);
    items.forEach(item => {
      if (checked) next.add(item.id);
      else next.delete(item.id);
    });
    setSelectedIds(next);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleToggleEntregado = (keyFactura: string, checked: boolean) => {
    const next = new Set(entregadosFisicos);
    if (checked) next.add(keyFactura);
    else next.delete(keyFactura);
    setEntregadosFisicos(next);
    localStorage.setItem(FISICOS_STORAGE_KEY, JSON.stringify(Array.from(next)));
  };

  const itemsParaExportar = registros.filter(r => selectedIds.has(r.id));

  const handleDownloadPDF = () => {
    if (itemsParaExportar.length === 0) return;
    const doc = new jspdf();
    const groupedExport = itemsParaExportar.reduce((acc, item) => {
      const key = item.numeroFactura;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, RegistroFactura[]>);

    const facturaKeys = Object.keys(groupedExport);

    facturaKeys.forEach((fKey, index) => {
      if (index > 0) doc.addPage();
      const items = groupedExport[fKey];
      const firstItem = items[0];
      const totalFactura = items.reduce((sum, i) => sum + i.valorTotal, 0);

      doc.setFontSize(18);
      doc.setTextColor(0, 85, 184);
      doc.text('CHAIDE - DETALLE DE FACTURACIÓN', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(50);
      doc.text(`N° FACTURA: ${formatInvoice(firstItem.numeroFactura)}`, 14, 32);
      doc.text(`CÓDIGO PROVEEDOR: ${firstItem.codigoProveedor}`, 14, 38);
      doc.text(`FECHA DE PROCESO: ${format(new Date(firstItem.fechaRegistro), "dd/MM/yyyy HH:mm")}`, 14, 44);
      
      const esFisico = entregadosFisicos.has(fKey);
      doc.setFontSize(11);
      doc.setTextColor(esFisico ? 22 : 220, esFisico ? 163 : 38, esFisico ? 74 : 38);
      doc.text(`ENTREGA FÍSICA: ${esFisico ? 'CONFIRMADA' : 'PENDIENTE'}`, 14, 52);

      const tableData = items.map(reg => [
        reg.transporte || 'N/A', 
        reg.numeroGasto || 'N/A',
        `$${reg.valorTotal.toFixed(2)}`,
        reg.estado
      ]);

      autoTable(doc, {
        startY: 60,
        head: [['N° Transporte', 'N° Gasto del Transporte', 'Monto del Rubro', 'Estado']],
        body: tableData,
        foot: [[{ content: 'VALOR TOTAL DE LA FACTURA', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `$${totalFactura.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }, '']],
        headStyles: { fillColor: [0, 85, 184], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [240, 244, 248], textColor: [0, 85, 184], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        styles: { fontSize: 10, cellPadding: 5 },
        margin: { top: 60 },
      });

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${index + 1} de ${facturaKeys.length} - Generado por Chaide RGT v1.0`, 14, doc.internal.pageSize.height - 10);
    });

    doc.save(`Reporte_Gastos_Transportes_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
  };

  const handleDownloadExcel = () => {
    if (itemsParaExportar.length === 0) return;
    const data = itemsParaExportar.map(reg => ({
      'Fecha': format(new Date(reg.fechaRegistro), "dd/MM/yyyy HH:mm"),
      'N° Factura': formatInvoice(reg.numeroFactura),
      'N° Gasto': reg.numeroGasto || 'N/A',
      'Transporte': reg.transporte || 'N/A',
      'Monto': reg.valorTotal,
      'Estado': reg.estado,
      'Entregado Físico': entregadosFisicos.has(reg.numeroFactura) ? 'SÍ' : 'NO'
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturación");
    XLSX.writeFile(workbook, `Reporte_Facturacion_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
  };

  const handleClearFilter = () => {
    setDateRange({ from: subDays(new Date(), 30), to: new Date() });
    setStatusFilter("PENDIENTE");
    setInvoiceFilter("");
  };

  const anyFilterActive = invoiceFilter.trim() !== "" || statusFilter !== "PENDIENTE";

  const totalFacturasRegistradas = new Set(registros.map(r => r.numeroFactura)).size;
  const totalFacturasProcesadas = new Set(registros.filter(r => entregadosFisicos.has(r.numeroFactura)).map(r => r.numeroFactura)).size;
  const totalFacturasPendientesFisico = new Set(registros.filter(r => !entregadosFisicos.has(r.numeroFactura)).map(r => r.numeroFactura)).size;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 bg-gray-50/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-primary uppercase">Panel de Control Operativo</h2>
          <p className="text-muted-foreground font-medium text-lg">Gestión detallada de gastos de transporte integrada.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card 
          className="border-l-8 border-l-blue-600 shadow-lg hover:shadow-xl transition-all border-y-0 border-r-0 cursor-pointer active:scale-95 group"
          onClick={() => setStatusFilter("TODOS")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-blue-600 transition-colors">Facturas Registradas</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors"><Package className="h-5 w-5 text-blue-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-blue-700">{totalFacturasRegistradas}</div>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Haz clic para ver todos los registros</p>
          </CardContent>
        </Card>

        <Card 
          className="border-l-8 border-l-orange-500 shadow-lg hover:shadow-xl transition-all border-y-0 border-r-0 cursor-pointer active:scale-95 group"
          onClick={() => setStatusFilter("PENDIENTE")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-orange-600 transition-colors">Pendientes Físicos</CardTitle>
            <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors"><Clock className="h-5 w-5 text-orange-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-orange-600">
               {totalFacturasPendientesFisico}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Haz clic para ver pendientes</p>
          </CardContent>
        </Card>

        <Card 
          className="border-l-8 border-l-green-600 shadow-lg hover:shadow-xl transition-all border-y-0 border-r-0 cursor-pointer active:scale-95 group"
          onClick={() => setStatusFilter("ENTREGADO")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-green-600 transition-colors">Facturas Procesadas</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-green-700">
              {totalFacturasProcesadas}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Haz clic para ver entregas físicas</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-2xl border-none rounded-3xl overflow-hidden">
        <CardHeader className="bg-white border-b-2 border-gray-100 px-10 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <CardTitle className="text-3xl font-black text-primary uppercase tracking-tighter">Gestión de Entregas</CardTitle>
              <CardDescription className="font-semibold text-base mt-1 text-gray-500">
                Visualización agrupada por Factura recuperada de la base de datos.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
                <Input 
                  placeholder="BUSCAR POR FACTURA" 
                  value={invoiceFilter} 
                  onChange={(e) => setInvoiceFilter(e.target.value)} 
                  className="h-12 pl-10 pr-10 border-2 border-primary/20 rounded-xl font-black uppercase tracking-tight bg-white" 
                />
                {invoiceFilter && (
                  <button 
                    onClick={() => setInvoiceFilter("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px] h-12 border-2 border-primary/20 rounded-xl font-black uppercase tracking-tight bg-white">
                  <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-primary/60" /><SelectValue placeholder="FILTRAR FÍSICO" /></div>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="PENDIENTE" className="font-bold text-orange-600 uppercase">PENDIENTE FÍSICO</SelectItem>
                  <SelectItem value="ENTREGADO" className="font-bold text-green-600 uppercase">ENTREGADO FÍSICO</SelectItem>
                  <SelectItem value="TODOS" className="font-bold">TODOS LOS REGISTROS</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="bg-white h-12 px-5 rounded-xl shadow-sm border-2 border-primary/20 flex items-center gap-3 hover:bg-gray-50 min-w-[240px]">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-black uppercase tracking-tight text-gray-700">
                      {dateRange?.from ? (dateRange.to ? <>{format(dateRange.from, "d MMM", { locale: es }).toUpperCase()} - {format(dateRange.to, "d MMM, yyyy", { locale: es }).toUpperCase()}</> : format(dateRange.from, "d 'DE' MMMM, yyyy", { locale: es }).toUpperCase()) : "SELECCIONAR PERIODO"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl overflow-hidden" align="end">
                  <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={es} className="p-6 bg-white" />
                  <div className="p-4 bg-gray-50 border-t flex justify-end">
                     <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)} className="text-xs font-bold text-primary"><RotateCcw className="mr-2 h-3 w-3" /> RESTABLECER FECHAS</Button>
                  </div>
                </PopoverContent>
              </Popover>
              
              {anyFilterActive && (
                <Button 
                  variant="destructive" 
                  onClick={handleClearFilter}
                  className="h-12 px-6 font-black uppercase tracking-widest shadow-md rounded-xl animate-in zoom-in-95 duration-200"
                >
                  <RotateCcw className="mr-2 h-5 w-5" /> ELIMINAR FILTROS
                </Button>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="lg" onClick={handleDownloadPDF} disabled={selectedIds.size === 0} className="border-2 border-primary text-primary font-black h-12 px-6 rounded-xl"><FileDown className="mr-3 h-5 w-5" /> EXPORTAR PDF {selectedIds.size > 0 && `(${selectedIds.size})`}</Button>
                <Button variant="outline" size="lg" onClick={handleDownloadExcel} disabled={selectedIds.size === 0} className="border-2 border-green-600 text-green-600 font-black h-12 px-6 rounded-xl"><FileSpreadsheet className="mr-3 h-5 w-5" /> EXPORTAR EXCEL {selectedIds.size > 0 && `(${selectedIds.size})`}</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6"><Loader2 className="h-14 w-14 animate-spin text-primary opacity-50" /><p className="text-muted-foreground font-black text-sm uppercase tracking-[0.3em]">Sincronizando gastos operativos...</p></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="hover:bg-transparent border-b-2">
                      <TableHead className="w-[50px] py-6 px-4 text-center">
                        <Checkbox 
                          checked={groupedRegistros.length > 0 && Array.from(selectedIds).length === registros.filter(r => groupedRegistros.some(g => g.keyFactura === r.numeroFactura)).length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="font-black text-xs uppercase text-gray-500 text-center tracking-widest py-6 px-4">Fecha Registro</TableHead>
                      <TableHead className="font-black text-xs uppercase text-gray-500 text-center tracking-widest">N° Factura</TableHead>
                      <TableHead className="text-right font-black text-xs uppercase text-gray-500 px-10 tracking-widest">Monto Total</TableHead>
                      <TableHead className="text-center font-black text-xs uppercase text-gray-500 px-6 tracking-widest">Físico</TableHead>
                      <TableHead className="text-center font-black text-xs uppercase text-gray-500 px-10 tracking-widest">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedGroups.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-24 text-muted-foreground italic font-bold text-lg">No hay gastos que mostrar.</TableCell></TableRow>
                    ) : (
                      pagedGroups.map((grupo) => {
                        const isExpanded = expandedRows.has(grupo.keyFactura);
                        const groupAllSelected = grupo.items.every(i => selectedIds.has(i.id));
                        const isFisicoEntregado = entregadosFisicos.has(grupo.keyFactura);
                        
                        return (
                          <React.Fragment key={grupo.keyFactura}>
                            <TableRow className={cn("hover:bg-primary/5 transition-all border-b border-gray-100 group cursor-pointer", isExpanded && "bg-primary/5")}>
                              <TableCell className="py-6 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <Checkbox 
                                  checked={groupAllSelected}
                                  onCheckedChange={(checked) => handleSelectGroup(grupo.items, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="text-center" onClick={() => toggleRow(grupo.keyFactura)}>
                                {isExpanded ? <ChevronDown className="h-6 w-6 text-primary" /> : <ChevronRight className="h-6 w-6 text-muted-foreground" />}
                              </TableCell>
                              <TableCell className="py-6 px-4 text-center" onClick={() => toggleRow(grupo.keyFactura)}>
                                <div className="flex flex-col">
                                  <span className="font-black text-sm text-gray-900">{format(new Date(grupo.fechaRegistro), "dd/MM/yyyy")}</span>
                                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{format(new Date(grupo.fechaRegistro), "HH:mm 'HRS'")}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center font-bold text-gray-600" onClick={() => toggleRow(grupo.keyFactura)}>
                                {formatInvoice(grupo.numeroFactura)}
                              </TableCell>
                              <TableCell className="text-right px-10" onClick={() => toggleRow(grupo.keyFactura)}>
                                <span className="text-xl font-black text-primary tracking-tighter">${grupo.valorTotalAcumulado.toFixed(2)}</span>
                              </TableCell>
                              <TableCell className="text-center px-6" onClick={(e) => e.stopPropagation()}>
                                <Checkbox 
                                  checked={isFisicoEntregado} 
                                  onCheckedChange={(checked) => handleToggleEntregado(grupo.keyFactura, !!checked)}
                                  className="border-2 border-primary/50 data-[state=checked]:bg-primary h-6 w-6"
                                />
                              </TableCell>
                              <TableCell className="text-center px-10" onClick={() => toggleRow(grupo.keyFactura)}>
                                <Badge className={cn("px-4 py-1 font-black uppercase text-[9px] tracking-widest", grupo.estado.toUpperCase() === 'TRANSFERIDO' || grupo.estado.toUpperCase() === 'A' ? "bg-green-600" : "bg-orange-500")}>
                                  {grupo.estado}
                                </Badge>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-muted/30 border-l-4 border-l-primary animate-in fade-in duration-300">
                                <TableCell colSpan={8} className="p-0">
                                  <div className="p-6">
                                    <div className="flex items-center gap-2 mb-4 text-primary font-black uppercase text-xs tracking-widest">
                                      <Package className="h-4 w-4" /> Detalle de Transportes asociados al Gasto
                                    </div>
                                    <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                                      <Table>
                                        <TableHeader className="bg-muted/50">
                                          <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[50px] text-center"></TableHead>
                                            <TableHead className="font-black text-[10px] uppercase py-3 pl-8">N° Transporte</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase text-center">N° Gasto del Transporte</TableHead>
                                            <TableHead className="text-right font-black text-[10px] uppercase pr-8">Monto Parcial</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {grupo.items.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-primary/5 group/sub">
                                              <TableCell className="text-center">
                                                <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)} />
                                              </TableCell>
                                              <TableCell className="py-4 pl-8">
                                                <div className="flex items-center gap-2 font-bold text-gray-600"><ReceiptText className="h-4 w-4 opacity-50" />{item.transporte || 'N/A'}</div>
                                              </TableCell>
                                              <TableCell className="text-center">
                                                <div className="inline-flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full font-black text-primary text-sm">
                                                  <Hash className="h-3 w-3" />
                                                  {item.numeroGasto || 'N/A'}
                                                </div>
                                              </TableCell>
                                              <TableCell className="text-right pr-8 font-black text-lg tracking-tighter text-gray-900">${item.valorTotal.toFixed(2)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                        <tfoot className="bg-gray-50 border-t">
                                          <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={3} className="text-right font-black text-[10px] uppercase tracking-widest py-3">Valor Total de la Factura</TableCell>
                                            <TableCell className="text-right pr-8 font-black text-xl text-primary tracking-tighter">
                                              ${grupo.valorTotalAcumulado.toFixed(2)}
                                            </TableCell>
                                          </TableRow>
                                        </tfoot>
                                      </Table>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-10 py-6 bg-gray-50 border-t border-gray-100">
                  <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    Página {currentPage} de {totalPages} 
                    <span className="ml-4 opacity-60">(Mostrando {groupedRegistros.length} registros filtrados)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="h-10 px-4 font-black border-2"><ChevronLeft className="h-4 w-4 mr-2" /> ANTERIOR</Button>
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} className="h-10 px-4 font-black border-2">SIGUIENTE <ChevronRight className="h-4 w-4 ml-2" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      <div className="text-center py-6">
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-60">Chaide - Sistema de Gestión de Gastos de Transportes v1.0</p>
      </div>
    </div>
  );
}

