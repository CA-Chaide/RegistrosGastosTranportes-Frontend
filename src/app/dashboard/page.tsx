
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { serviciosService } from '@/services/servicios.service';
import { Loader2, Calendar as CalendarIcon, Package, CheckCircle2, Clock, ChevronDown, FileDown, RotateCcw, ChevronLeft, ChevronRight, Filter, FileSpreadsheet, Search, ReceiptText, X } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
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
  numeroGasto?: string;
  transporte?: string;
}

interface GrupoDashboard {
  numeroRegistro: string;
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
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [invoiceFilter, setInvoiceFilter] = useState<string>("");
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const resp = await serviciosService.getRegistrosFacturas();
        setRegistros(resp.data || []);

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
    };
    loadData();
  }, []);

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

  const toggleRow = (numeroRegistro: string) => {
    const next = new Set(expandedRows);
    if (next.has(numeroRegistro)) {
      next.delete(numeroRegistro);
    } else {
      next.add(numeroRegistro);
    }
    setExpandedRows(next);
  };

  const groupedRegistros = useMemo(() => {
    const groups: Record<string, GrupoDashboard> = {};
    
    const baseFiltrada = registros.filter(reg => {
      let matchesDate = true;
      if (dateRange?.from) {
        const fechaReg = new Date(reg.fechaRegistro);
        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        matchesDate = isWithinInterval(fechaReg, { start, end });
      }

      let matchesInvoice = true;
      if (invoiceFilter.trim()) {
        const cleanInvoice = invoiceFilter.toLowerCase().replace(/-/g, '');
        matchesInvoice = reg.numeroFactura.toLowerCase().includes(cleanInvoice);
      }

      return matchesDate && matchesInvoice;
    });

    baseFiltrada.forEach(reg => {
      const key = reg.numeroRegistro;
      if (!groups[key]) {
        groups[key] = {
          numeroRegistro: key,
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
      const isEntregado = entregadosFisicos.has(grupo.numeroRegistro);
      if (statusFilter === "ENTREGADO") return isEntregado;
      if (statusFilter === "PENDIENTE") return !isEntregado;
      return true;
    }).sort((a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());
  }, [registros, dateRange, statusFilter, invoiceFilter, entregadosFisicos]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange, statusFilter, invoiceFilter]);

  const pagedGroups = useMemo(() => {
    let start = 0;
    let end = 50;
    if (currentPage > 1) {
      start = 50 + (currentPage - 2) * 100;
      end = start + 100;
    }
    return groupedRegistros.slice(start, end);
  }, [groupedRegistros, currentPage]);

  const totalPages = useMemo(() => {
    const total = groupedRegistros.length;
    if (total <= 50) return 1;
    return 1 + Math.ceil((total - 50) / 100);
  }, [groupedRegistros]);

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

  const handleToggleEntregado = (numeroRegistro: string, checked: boolean) => {
    const next = new Set(entregadosFisicos);
    if (checked) next.add(numeroRegistro);
    else next.delete(numeroRegistro);
    setEntregadosFisicos(next);
    localStorage.setItem(FISICOS_STORAGE_KEY, JSON.stringify(Array.from(next)));
  };

  const itemsParaExportar = registros.filter(r => selectedIds.has(r.id));

  const handleDownloadPDF = () => {
    if (itemsParaExportar.length === 0) return;
    const doc = new jspdf();
    const groupedExport = itemsParaExportar.reduce((acc, item) => {
      if (!acc[item.numeroRegistro]) acc[item.numeroRegistro] = [];
      acc[item.numeroRegistro].push(item);
      return acc;
    }, {} as Record<string, RegistroFactura[]>);

    const registroIds = Object.keys(groupedExport);

    registroIds.forEach((regId, index) => {
      if (index > 0) doc.addPage();
      const items = groupedExport[regId];
      const firstItem = items[0];
      const totalFactura = items.reduce((sum, i) => sum + i.valorTotal, 0);

      doc.setFontSize(18);
      doc.setTextColor(0, 85, 184);
      doc.text('CHAIDE - DETALLE DE FACTURACIÓN', 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(50);
      doc.text(`N° REGISTRO ÚNICO: ${regId}`, 14, 32);
      doc.text(`N° FACTURA: ${formatInvoice(firstItem.numeroFactura)}`, 14, 38);
      doc.text(`CÓDIGO PROVEEDOR: ${firstItem.codigoProveedor}`, 14, 44);
      doc.text(`FECHA DE PROCESO: ${format(new Date(firstItem.fechaRegistro), "dd/MM/yyyy HH:mm")}`, 14, 50);
      
      const esFisico = entregadosFisicos.has(regId);
      doc.setFontSize(11);
      doc.setTextColor(esFisico ? 22 : 220, esFisico ? 163 : 38, esFisico ? 74 : 38);
      doc.text(`ENTREGA FÍSICA: ${esFisico ? 'CONFIRMADA' : 'PENDIENTE'}`, 14, 58);

      const tableData = items.map(reg => [
        reg.numeroGasto || 'N/A', 
        reg.transporte || 'N/A', 
        `$${reg.valorTotal.toFixed(2)}`,
        reg.estado
      ]);

      autoTable(doc, {
        startY: 64,
        head: [['N° Gasto', 'N° Transporte', 'Monto del Rubro', 'Estado']],
        body: tableData,
        foot: [[{ content: 'VALOR TOTAL DE LA FACTURA', colSpan: 2, styles: { halign: 'right', fontStyle: 'bold' } }, { content: `$${totalFactura.toFixed(2)}`, styles: { halign: 'right', fontStyle: 'bold' } }, '']],
        headStyles: { fillColor: [0, 85, 184], textColor: [255, 255, 255], fontStyle: 'bold' },
        footStyles: { fillColor: [240, 244, 248], textColor: [0, 85, 184], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        styles: { fontSize: 10, cellPadding: 5 },
        margin: { top: 64 },
      });

      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${index + 1} de ${registroIds.length} - Generado por Chaide RGT v1.0`, 14, doc.internal.pageSize.height - 10);
    });

    doc.save(`Reporte_Facturas_Individuales_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
  };

  const handleDownloadExcel = () => {
    if (itemsParaExportar.length === 0) return;
    const data = itemsParaExportar.map(reg => ({
      'Fecha': format(new Date(reg.fechaRegistro), "dd/MM/yyyy HH:mm"),
      'N° Gasto': reg.numeroGasto || 'N/A',
      'N° Factura': formatInvoice(reg.numeroFactura),
      'Transporte': reg.transporte || 'N/A',
      'Monto': reg.valorTotal,
      'Estado': reg.estado,
      'Entregado Físico': entregadosFisicos.has(reg.numeroRegistro) ? 'SÍ' : 'NO'
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturación");
    XLSX.writeFile(workbook, `Reporte_Facturacion_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
  };

  const handleClearFilter = () => {
    setDateRange(undefined);
    setStatusFilter("TODOS");
    setInvoiceFilter("");
  };

  const anyFilterActive = invoiceFilter.trim() !== "" || statusFilter !== "TODOS" || dateRange !== undefined;

  const totalFacturasRegistradas = new Set(registros.map(r => r.numeroRegistro)).size;
  const totalFacturasProcesadas = new Set(registros.filter(r => r.estado.toUpperCase() === 'PROCESADO').map(r => r.numeroRegistro)).size;
  const totalFacturasPendientesFisico = new Set(registros.filter(r => !entregadosFisicos.has(r.numeroRegistro)).map(r => r.numeroRegistro)).size;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 bg-gray-50/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-primary uppercase">Panel de Control Operativo</h2>
          <p className="text-muted-foreground font-medium text-lg">Resumen detallado de facturación y transportes registrados.</p>
        </div>
        {anyFilterActive && (
          <Button 
            variant="destructive" 
            onClick={handleClearFilter}
            className="h-12 font-black uppercase tracking-widest shadow-lg animate-in zoom-in-95 duration-200"
          >
            <RotateCcw className="mr-2 h-5 w-5" /> LIMPIAR FILTROS
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-l-8 border-l-blue-600 shadow-lg hover:shadow-xl transition-shadow border-y-0 border-r-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Facturas Registradas</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg"><Package className="h-5 w-5 text-blue-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-blue-700">{totalFacturasRegistradas}</div>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Facturas ingresadas en el sistema</p>
          </CardContent>
        </Card>

        <Card className="border-l-8 border-l-orange-500 shadow-lg hover:shadow-xl transition-shadow border-y-0 border-r-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pendientes</CardTitle>
            <div className="p-2 bg-orange-100 rounded-lg"><Clock className="h-5 w-5 text-orange-500" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-orange-600">
               {totalFacturasPendientesFisico}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Facturas por liquidar físicamente</p>
          </CardContent>
        </Card>

        <Card className="border-l-8 border-l-green-600 shadow-lg hover:shadow-xl transition-shadow border-y-0 border-r-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Facturas Procesadas</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /></div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-green-700">
              {totalFacturasProcesadas}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Facturas validadas exitosamente</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-2xl border-none rounded-3xl overflow-hidden">
        <CardHeader className="bg-white border-b-2 border-gray-100 px-10 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <CardTitle className="text-3xl font-black text-primary uppercase tracking-tighter">Detalles de Facturación</CardTitle>
              <CardDescription className="font-semibold text-base mt-1 text-gray-500">
                {dateRange?.from 
                  ? dateRange.to 
                    ? `Registros desde ${format(dateRange.from, "d 'de' MMMM", { locale: es })} hasta ${format(dateRange.to, "d 'de' MMMM", { locale: es })}`
                    : `Registros del ${format(dateRange.from, "d 'de' MMMM", { locale: es })}`
                  : "Mostrando todos los registros históricos"
                }
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
                <Input 
                  placeholder="FILTRAR POR FACTURA" 
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
                  <SelectItem value="TODOS" className="font-bold">TODOS LOS REGISTROS</SelectItem>
                  <SelectItem value="ENTREGADO" className="font-bold text-green-600 uppercase">ENTREGADO FÍSICO</SelectItem>
                  <SelectItem value="PENDIENTE" className="font-bold text-orange-600 uppercase">PENDIENTE FÍSICO</SelectItem>
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
              <div className="flex gap-2">
                <Button variant="outline" size="lg" onClick={handleDownloadPDF} disabled={selectedIds.size === 0} className="border-2 border-primary text-primary font-black h-12 px-6 rounded-xl"><FileDown className="mr-3 h-5 w-5" /> EXPORTAR PDF {selectedIds.size > 0 && `(${selectedIds.size})`}</Button>
                <Button variant="outline" size="lg" onClick={handleDownloadExcel} disabled={selectedIds.size === 0} className="border-2 border-green-600 text-green-600 font-black h-12 px-6 rounded-xl"><FileSpreadsheet className="mr-3 h-5 w-5" /> EXPORTAR EXCEL {selectedIds.size > 0 && `(${selectedIds.size})`}</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6"><Loader2 className="h-14 w-14 animate-spin text-primary opacity-50" /><p className="text-muted-foreground font-black text-sm uppercase tracking-[0.3em]">Sincronizando datos operativos...</p></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="hover:bg-transparent border-b-2">
                      <TableHead className="w-[50px] py-6 px-4 text-center">
                        <Checkbox 
                          checked={groupedRegistros.length > 0 && Array.from(selectedIds).length === registros.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead className="font-black text-xs uppercase text-gray-500 text-center tracking-widest py-6 px-4">Fecha</TableHead>
                      <TableHead className="font-black text-xs uppercase text-gray-500 text-center tracking-widest">N° Factura</TableHead>
                      <TableHead className="font-black text-xs uppercase text-gray-500 text-center tracking-widest">Proveedor</TableHead>
                      <TableHead className="text-right font-black text-xs uppercase text-gray-500 px-10 tracking-widest">Monto Total</TableHead>
                      <TableHead className="text-center font-black text-xs uppercase text-gray-500 px-6 tracking-widest">Físico</TableHead>
                      <TableHead className="text-center font-black text-xs uppercase text-gray-500 px-10 tracking-widest">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedGroups.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-24 text-muted-foreground italic font-bold text-lg">No se encontraron registros.</TableCell></TableRow>
                    ) : (
                      pagedGroups.map((grupo) => {
                        const isExpanded = expandedRows.has(grupo.numeroRegistro);
                        const groupAllSelected = grupo.items.every(i => selectedIds.has(i.id));
                        const isFisicoEntregado = entregadosFisicos.has(grupo.numeroRegistro);
                        
                        return (
                          <React.Fragment key={grupo.numeroRegistro}>
                            <TableRow className={cn("hover:bg-primary/5 transition-all border-b border-gray-100 group cursor-pointer", isExpanded && "bg-primary/5")}>
                              <TableCell className="py-6 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <Checkbox 
                                  checked={groupAllSelected}
                                  onCheckedChange={(checked) => handleSelectGroup(grupo.items, !!checked)}
                                />
                              </TableCell>
                              <TableCell className="text-center" onClick={() => toggleRow(grupo.numeroRegistro)}>
                                {isExpanded ? <ChevronDown className="h-6 w-6 text-primary" /> : <ChevronRight className="h-6 w-6 text-muted-foreground" />}
                              </TableCell>
                              <TableCell className="py-6 px-4 text-center" onClick={() => toggleRow(grupo.numeroRegistro)}>
                                <div className="flex flex-col">
                                  <span className="font-black text-sm text-gray-900">{format(new Date(grupo.fechaRegistro), "dd/MM/yyyy")}</span>
                                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{format(new Date(grupo.fechaRegistro), "HH:mm 'HRS'")}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-black text-gray-900 tabular-nums text-center tracking-tight" onClick={() => toggleRow(grupo.numeroRegistro)}>
                                {formatInvoice(grupo.numeroFactura)}
                              </TableCell>
                              <TableCell className="text-center font-bold text-gray-600" onClick={() => toggleRow(grupo.numeroRegistro)}>
                                {grupo.codigoProveedor}
                              </TableCell>
                              <TableCell className="text-right px-10" onClick={() => toggleRow(grupo.numeroRegistro)}>
                                <span className="text-xl font-black text-primary tracking-tighter">${grupo.valorTotalAcumulado.toFixed(2)}</span>
                              </TableCell>
                              <TableCell className="text-center px-6" onClick={(e) => e.stopPropagation()}>
                                <Checkbox 
                                  checked={isFisicoEntregado} 
                                  onCheckedChange={(checked) => handleToggleEntregado(grupo.numeroRegistro, !!checked)}
                                  className="border-2 border-primary/50 data-[state=checked]:bg-primary h-6 w-6"
                                />
                              </TableCell>
                              <TableCell className="text-center px-10" onClick={() => toggleRow(grupo.numeroRegistro)}>
                                <Badge className={cn("px-4 py-1 font-black uppercase text-[9px] tracking-widest", grupo.estado.toUpperCase() === 'PROCESADO' ? "bg-green-600" : "bg-orange-500")}>
                                  {grupo.estado}
                                </Badge>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-muted/30 border-l-4 border-l-primary animate-in fade-in duration-300">
                                <TableCell colSpan={8} className="p-0">
                                  <div className="p-6">
                                    <div className="flex items-center gap-2 mb-4 text-primary font-black uppercase text-xs tracking-widest">
                                      <Package className="h-4 w-4" /> Desglose de Transportes y Gastos vinculados a la factura
                                    </div>
                                    <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
                                      <Table>
                                        <TableHeader className="bg-muted/50">
                                          <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-[50px] text-center"></TableHead>
                                            <TableHead className="font-black text-[10px] uppercase py-3 pl-8">N° Gasto</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase text-center">N° Transporte</TableHead>
                                            <TableHead className="text-right font-black text-[10px] uppercase pr-8">Monto Rubro</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {grupo.items.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-primary/5 group/sub">
                                              <TableCell className="text-center">
                                                <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)} />
                                              </TableCell>
                                              <TableCell className="py-4 pl-8">
                                                <div className="flex items-center gap-2 font-bold text-gray-600"><ReceiptText className="h-4 w-4 opacity-50" />{item.numeroGasto || 'N/A'}</div>
                                              </TableCell>
                                              <TableCell className="text-center font-black text-primary text-base">{item.transporte || 'N/A'}</TableCell>
                                              <TableCell className="text-right pr-8 font-black text-lg tracking-tighter text-gray-900">${item.valorTotal.toFixed(2)}</TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                        <tfoot className="bg-gray-50 border-t">
                                          <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={3} className="text-right font-black text-[10px] uppercase tracking-widest py-3">Total de la Factura</TableCell>
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
                    <span className="ml-4 opacity-60">(Mostrando {groupedRegistros.length} facturas agrupadas)</span>
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
