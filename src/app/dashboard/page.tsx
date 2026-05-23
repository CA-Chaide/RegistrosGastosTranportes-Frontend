
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { serviciosService } from '@/services/servicios.service';
import { Loader2, Calendar as CalendarIcon, Package, CheckCircle2, Clock, ChevronDown, FileDown, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import jspdf from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DateRange } from "react-day-picker";

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

export default function DashboardPage() {
  const [registros, setRegistros] = useState<RegistroFactura[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date(),
  });

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const resp = await serviciosService.getRegistrosFacturas();
        setRegistros(resp.data || []);
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

  const registrosFiltrados = useMemo(() => {
    return registros.filter(reg => {
      if (!dateRange?.from) return true;
      const fechaReg = new Date(reg.fechaRegistro);
      const start = startOfDay(dateRange.from);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      return isWithinInterval(fechaReg, { start, end });
    });
  }, [registros, dateRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange]);

  const pagedRegistros = useMemo(() => {
    let start = 0;
    let end = 50;
    
    if (currentPage > 1) {
      start = 50 + (currentPage - 2) * 100;
      end = start + 100;
    }
    
    return registrosFiltrados.slice(start, end);
  }, [registrosFiltrados, currentPage]);

  const totalPages = useMemo(() => {
    const total = registrosFiltrados.length;
    if (total <= 50) return 1;
    return 1 + Math.ceil((total - 50) / 100);
  }, [registrosFiltrados]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(registrosFiltrados.map(r => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const itemsParaExportar = registrosFiltrados.filter(r => selectedIds.has(r.id));
  const totalMontoExportar = itemsParaExportar.reduce((acc, r) => acc + r.valorTotal, 0);

  const handleDownloadPDF = () => {
    if (itemsParaExportar.length === 0) return;

    const doc = new jspdf();
    let dateStr = "";
    
    if (dateRange?.from) {
      if (dateRange.to) {
        dateStr = `Del ${format(dateRange.from, "dd/MM/yyyy")} al ${format(dateRange.to, "dd/MM/yyyy")}`;
      } else {
        dateStr = `Día ${format(dateRange.from, "dd/MM/yyyy")}`;
      }
    } else {
      dateStr = "Todos los registros";
    }

    doc.setFontSize(18);
    doc.setTextColor(0, 85, 184);
    doc.text('CHAIDE - REPORTE DE FACTURACIÓN SELECCIONADA', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Periodo: ${dateStr}`, 14, 30);
    doc.text(`Items seleccionados: ${itemsParaExportar.length}`, 14, 36);

    const tableData = itemsParaExportar.map(reg => [
      format(new Date(reg.fechaRegistro), "dd/MM/yyyy HH:mm"),
      reg.numeroGasto || 'N/A',
      formatInvoice(reg.numeroFactura),
      reg.transporte || 'N/A',
      `$${reg.valorTotal.toFixed(2)}`,
      reg.estado
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['Fecha', 'N° Gasto', 'N° Factura', 'Transporte', 'Monto', 'Estado']],
      body: tableData,
      foot: [[
        { content: 'TOTAL DE SELECCIÓN', colSpan: 4, styles: { halign: 'right' } },
        { content: `$${totalMontoExportar.toFixed(2)}`, styles: { halign: 'right' } },
        ''
      ]],
      headStyles: { fillColor: [0, 85, 184], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [0, 85, 184], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 244, 248] },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Generado el ${format(new Date(), "dd/MM/yyyy HH:mm:ss")} - Página ${i} de ${pageCount}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    doc.save(`Reporte_Facturacion_Seleccionada_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
  };

  const handleClearFilter = () => {
    setDateRange(undefined);
  };

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 bg-gray-50/50">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-primary uppercase">Panel de Control Operativo</h2>
          <p className="text-muted-foreground font-medium text-lg">Resumen detallado de facturación y transportes registrados.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Card 1: Transportes (Blue) */}
        <Card className="border-l-8 border-l-blue-600 shadow-lg hover:shadow-xl transition-shadow border-y-0 border-r-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Transportes</CardTitle>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-blue-700">{registrosFiltrados.length}</div>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Unidades vinculadas</p>
          </CardContent>
        </Card>

        {/* Card 2: Pendientes (Orange) */}
        <Card className="border-l-8 border-l-orange-500 shadow-lg hover:shadow-xl transition-shadow border-y-0 border-r-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pendientes</CardTitle>
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-5 w-5 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-orange-600">0</div>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Por liquidar</p>
          </CardContent>
        </Card>

        {/* Card 3: Registros Exitosos (Green) */}
        <Card className="border-l-8 border-l-green-600 shadow-lg hover:shadow-xl transition-shadow border-y-0 border-r-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Registros Exitosos</CardTitle>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-green-700">{registrosFiltrados.length}</div>
            <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tight">Facturas procesadas</p>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={cn(
                      "bg-white h-12 px-5 rounded-xl shadow-sm border-2 border-primary/20 flex items-center gap-3 hover:bg-gray-50 transition-all group min-w-[240px]",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-black uppercase tracking-tight text-gray-700">
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>{format(dateRange.from, "d MMM", { locale: es }).toUpperCase()} - {format(dateRange.to, "d MMM, yyyy", { locale: es }).toUpperCase()}</>
                        ) : (
                          format(dateRange.from, "d 'DE' MMMM, yyyy", { locale: es }).toUpperCase()
                        )
                      ) : (
                        "SELECCIONAR PERIODO"
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto group-data-[state=open]:rotate-180 transition-transform" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-3xl overflow-hidden" align="end">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={es}
                    className="p-6 bg-white"
                  />
                  <div className="p-4 bg-gray-50 border-t flex justify-end">
                     <Button variant="ghost" size="sm" onClick={handleClearFilter} className="text-xs font-bold text-primary">
                       <RotateCcw className="mr-2 h-3 w-3" /> RESTABLECER
                     </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Button 
                variant="outline" 
                size="lg" 
                onClick={handleDownloadPDF}
                disabled={selectedIds.size === 0}
                className="border-2 border-primary text-primary hover:bg-primary/5 font-black h-12 px-6 rounded-xl transition-all"
              >
                <FileDown className="mr-3 h-5 w-5" />
                EXPORTAR PDF {selectedIds.size > 0 && `(${selectedIds.size})`}
              </Button>
              
              <Badge className={cn(
                "px-5 py-2 h-12 flex items-center font-black text-xs uppercase tracking-widest border-none rounded-full transition-colors",
                dateRange?.from ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"
              )}>
                {dateRange?.from ? "FILTRADO POR FECHA" : "MOSTRANDO TODO"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6">
              <Loader2 className="h-14 w-14 animate-spin text-primary opacity-50" />
              <p className="text-muted-foreground font-black text-sm uppercase tracking-[0.3em]">Sincronizando datos operativos...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow className="hover:bg-transparent border-b-2">
                      <TableHead className="w-[50px] py-6 px-4 text-center">
                        <Checkbox 
                          checked={registrosFiltrados.length > 0 && selectedIds.size === registrosFiltrados.length}
                          onCheckedChange={handleSelectAll}
                          aria-label="Seleccionar todo"
                        />
                      </TableHead>
                      <TableHead className="w-[200px] font-black text-xs uppercase text-gray-500 py-6 px-4 text-center tracking-widest">Fecha</TableHead>
                      <TableHead className="font-black text-xs uppercase text-gray-500 text-center tracking-widest">N° Gasto</TableHead>
                      <TableHead className="font-black text-xs uppercase text-gray-500 text-center tracking-widest">N° Factura</TableHead>
                      <TableHead className="font-black text-xs uppercase text-gray-500 text-center tracking-widest">Transporte</TableHead>
                      <TableHead className="text-right font-black text-xs uppercase text-gray-500 px-10 tracking-widest">Monto</TableHead>
                      <TableHead className="text-center font-black text-xs uppercase text-gray-500 px-10 tracking-widest">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRegistros.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-24 text-muted-foreground italic font-bold text-lg">
                          No se encontraron registros para el rango seleccionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedRegistros.map((item) => (
                        <TableRow key={item.id} className="hover:bg-primary/5 transition-all border-b border-gray-100 group">
                          <TableCell className="py-6 px-4 text-center">
                            <Checkbox 
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={(checked) => handleSelectRow(item.id, !!checked)}
                              aria-label={`Seleccionar registro ${item.numeroFactura}`}
                            />
                          </TableCell>
                          <TableCell className="py-6 px-4 text-center">
                            <div className="flex flex-col">
                              <span className="font-black text-sm text-gray-900 group-hover:text-primary transition-colors">
                                {format(new Date(item.fechaRegistro), "dd/MM/yyyy", { locale: es })}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">
                                {format(new Date(item.fechaRegistro), "HH:mm 'HRS'")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-bold text-gray-500 text-center text-sm">
                            {item.numeroGasto || 'N/A'}
                          </TableCell>
                          <TableCell className="font-black text-gray-900 tabular-nums text-center tracking-tight">
                            {formatInvoice(item.numeroFactura)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                              <span className="font-black text-primary tracking-tight">{item.transporte || 'N/A'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-10">
                            <span className="text-xl font-black text-primary tracking-tighter">
                              ${item.valorTotal.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center px-10">
                            <Badge className="bg-green-600 hover:bg-green-700 px-4 py-1 font-black uppercase text-[9px] tracking-widest shadow-md border-none">
                              {item.estado}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-10 py-6 bg-gray-50 border-t border-gray-100">
                  <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                    Página {currentPage} de {totalPages} 
                    <span className="ml-4 opacity-60">
                      (Mostrando {currentPage === 1 ? '50' : '100'} de {registrosFiltrados.length} registros)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="h-10 px-4 font-black border-2"
                    >
                      <ChevronLeft className="h-4 w-4 mr-2" />
                      ANTERIOR
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="h-10 px-4 font-black border-2"
                    >
                      SIGUIENTE
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      <div className="text-center py-6">
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-60">
          Chaide - Sistema de Gestión de Gastos de Transportes v1.0
        </p>
      </div>
    </div>
  );
}
