
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, ChevronDown, Search, Layers } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { serviciosService } from '@/services/servicios.service';
import type { BodyListResponse } from '@/types/body-list-response';
import { cn } from '@/lib/utils';

const formatSmallDateTime = (date: Date) => format(date, "yyyy-MM-dd HH:mm:ss");

export default function TrackDPage() {
  const [step, setStep] = useState(1);
  const [codigoTransportista, setCodigoTransportista] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });
  const [estadoSeleccionado, setEstadoSeleccionado] = useState<'A' | 'C'>('A');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultData, setResultData] = useState<any[]>([]);
  const [expandedFacturas, setExpandedFacturas] = useState<Set<string>>(new Set());

  const canContinueFromStep1 = codigoTransportista.trim().length > 0;
  const canContinueFromStep2 = canContinueFromStep1 && !!dateRange?.from && !!dateRange?.to;

  const getRobustValue = (obj: any, keys: string[]) => {
    if (!obj) return undefined;
    const actualKeys = Object.keys(obj);
    for (const key of keys) {
      const foundKey = actualKeys.find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null && obj[foundKey] !== '') {
        return obj[foundKey];
      }
    }
    return undefined;
  };

  const dateSummary = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'Seleccionar rango de fechas';
    return `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`;
  }, [dateRange]);

  const fetchInformacion = async () => {
    if (!canContinueFromStep2) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fecha_inicio = formatSmallDateTime(startOfDay(dateRange!.from!));
      const fecha_fin = formatSmallDateTime(endOfDay(dateRange!.to!));
      const response = await serviciosService.getInformacionGastosTransportes(
        estadoSeleccionado,
        fecha_inicio,
        fecha_fin,
        codigoTransportista,
      );

      const dataArray = Array.isArray(response.data) ? response.data : [];
      setResultData(dataArray);
    } catch (err) {
      console.error('Error al cargar información de gastos:', err);
      setError('No se pudo obtener la información. Intente nuevamente.');
      setResultData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step === 3) {
      fetchInformacion();
    }
  }, [step, estadoSeleccionado, dateRange, codigoTransportista]);

  const stepItems = [
    { id: 1, title: 'Transportista', description: 'Ingresa el código del transportista' },
    { id: 2, title: 'Fechas y estado', description: 'Selecciona el rango de fechas y el estado' },
    { id: 3, title: 'Resultados', description: 'Consulta la información usando el servicio' },
  ];

  const getInvoiceKey = (item: any) => String(getRobustValue(item, ['NumFactura', 'numeroFactura', 'factura', 'Factura', 'invoice', 'Invoice']) || 'SIN_FACTURA');
  const getNumericValue = (item: any) => {
    const raw = getRobustValue(item, ['ValorGasto', 'valor', 'monto', 'total', 'Total', 'importe']);
    if (raw == null || raw === '') return 0;
    return typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.')) || 0;
  };

  const groupedResults = useMemo(() => {
    const groups: Record<string, { factura: string; total: number; items: any[] }> = {};

    resultData.forEach(item => {
      const factura = getInvoiceKey(item);
      const valor = getNumericValue(item);

      if (!groups[factura]) {
        groups[factura] = { factura, total: 0, items: [] };
      }

      groups[factura].items.push(item);
      groups[factura].total += valor;
    });

    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [resultData]);

  const detailColumns = useMemo(() => {
    const columns = new Set<string>();
    resultData.forEach(item => {
      Object.keys(item || {}).forEach(key => columns.add(key));
    });
    return Array.from(columns);
  }, [resultData]);

  const toggleFactura = (factura: string) => {
    const next = new Set(expandedFacturas);
    if (next.has(factura)) {
      next.delete(factura);
    } else {
      next.add(factura);
    }
    setExpandedFacturas(next);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-l-8 border-primary pl-6 py-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Seguimiento de Transferencias</h1>
            <p className="text-muted-foreground text-lg">Busca gastos por transportista, periodo y estado usando el paso a paso.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
            <Layers className="h-4 w-4" /> 3 pasos
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {stepItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id)}
              className={cn(
                'group block rounded-3xl border p-5 text-left transition hover:border-primary/80 hover:bg-primary/5',
                step === item.id ? 'border-primary bg-primary/10' : 'border-slate-200 bg-white'
              )}
            >
              <div className={cn('mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-black', step === item.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600')}>
                {item.id}
              </div>
              <p className="text-base font-black uppercase text-slate-900">{item.title}</p>
              <p className="text-sm text-slate-500">{item.description}</p>
            </button>
          ))}
        </div>
      </div>

      <Card className="shadow-2xl border-none rounded-3xl overflow-hidden border-t-4 border-t-primary">
        <CardHeader className="bg-muted/30 px-8 py-6">
          <CardTitle className="text-2xl font-black text-primary uppercase tracking-tight">Paso {step} de 3</CardTitle>
          <CardDescription className="text-base font-medium">
            {step === 1 && 'Ingresa el código del transportista para iniciar la búsqueda.'}
            {step === 2 && 'Elige un rango de fechas personalizado y selecciona el estado que quieres filtrar.'}
            {step === 3 && 'Consulta los resultados y revisa los gastos recuperados del servicio.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="max-w-2xl">
                <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Código del transportista</label>
                <Input
                  value={codigoTransportista}
                  onChange={(event) => setCodigoTransportista(event.target.value)}
                  placeholder="Ej. T12345"
                  className="h-14 text-lg"
                />
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <p>Este código se enviará como <span className="font-semibold">agente_transporte</span> al servicio.</p>
                <p>Avanza al siguiente paso para seleccionar el intervalo de fechas.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Intervalo de fechas</p>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-700">
                      <span className="font-semibold">{dateSummary}</span>
                      <Badge className="bg-primary text-primary-foreground">Fechas</Badge>
                    </div>
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      locale={es}
                      numberOfMonths={2}
                      className="rounded-3xl"
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-600">Estado</p>
                  <RadioGroup value={estadoSeleccionado} onValueChange={(value) => setEstadoSeleccionado(value as 'A' | 'C')} className="grid gap-3">
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-primary/80">
                      <RadioGroupItem value="A" />
                      <div>
                        <div className="font-semibold text-slate-900">No transferido</div>
                        <div className="text-sm text-slate-600">Filtra con estado <span className="font-semibold">A</span>.</div>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-primary/80">
                      <RadioGroupItem value="C" />
                      <div>
                        <div className="font-semibold text-slate-900">Transferido</div>
                        <div className="text-sm text-slate-600">Filtra con estado <span className="font-semibold">C</span>.</div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Transportista</p>
                  <p className="mt-3 text-xl font-black text-slate-900">{codigoTransportista || 'No definido'}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Estado</p>
                  <p className="mt-3 text-xl font-black text-slate-900">{estadoSeleccionado === 'A' ? 'No transferido' : 'Transferido'}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Período</p>
                  <p className="mt-3 text-xl font-black text-slate-900">{dateSummary}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                {/* <div className="space-y-2">
                  <p className="text-sm text-slate-600">La consulta se ejecuta con el servicio:</p>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                    <Search className="h-4 w-4" /> getInformacionGastosTransportes
                  </div>
                </div> */}
                <Button onClick={fetchInformacion} disabled={loading || !canContinueFromStep2}>
                  {loading ? 'Consultando...' : 'Refrescar consulta'}
                </Button>
              </div>

              {error && (
                <div className="rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive-foreground">{error}</div>
              )}

              {!loading && !resultData.length && !error && (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">No se encontraron resultados para los filtros seleccionados.</div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 text-slate-600">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="mt-4 font-semibold">Cargando resultados...</p>
                </div>
              )}

              {!loading && resultData.length > 0 && (
                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-100">
                      <TableRow>
                        <TableHead className="w-[40px]" />
                        <TableHead className="py-4 text-left text-xs uppercase tracking-[0.2em] text-slate-500">Factura</TableHead>
                        <TableHead className="py-4 text-right text-xs uppercase tracking-[0.2em] text-slate-500">Total</TableHead>
                        <TableHead className="py-4 text-right text-xs uppercase tracking-[0.2em] text-slate-500">Registros</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedResults.map((group) => {
                        const isExpanded = expandedFacturas.has(group.factura);
                        return (
                          <React.Fragment key={group.factura}>
                            <TableRow
                              className={cn(
                                'cursor-pointer hover:bg-slate-50',
                                isExpanded ? 'bg-slate-50' : ''
                              )}
                              onClick={() => toggleFactura(group.factura)}
                            >
                              <TableCell className="text-center">
                                <ChevronDown
                                  className={cn(
                                    'h-5 w-5 text-primary transition-transform',
                                    isExpanded ? 'rotate-180' : 'rotate-0'
                                  )}
                                />
                              </TableCell>
                              <TableCell className="py-4 text-left font-black text-slate-900">{group.factura}</TableCell>
                              <TableCell className="py-4 text-right font-black text-primary">${group.total.toFixed(2)}</TableCell>
                              <TableCell className="py-4 text-right text-sm text-slate-600">{group.items.length}</TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-slate-50">
                                <TableCell colSpan={4} className="p-0">
                                  <div className="overflow-x-auto rounded-b-3xl border-t border-slate-200 bg-white px-6 py-5">
                                    <div className="mb-4 flex items-center justify-between gap-4">
                                      <div>
                                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Detalle de gastos</p>
                                        <p className="text-xs text-slate-500">{group.items.length} registros asociados</p>
                                      </div>
                                      <div className="text-right text-sm text-slate-600">Total: <span className="font-black text-slate-900">${group.total.toFixed(2)}</span></div>
                                    </div>
                                    <Table>
                                      <TableHeader className="bg-slate-100">
                                        <TableRow>
                                          {detailColumns.map((column) => (
                                            <TableHead key={column} className="py-3 text-left text-xs uppercase tracking-[0.2em] text-slate-500">{column}</TableHead>
                                          ))}
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {group.items.map((item, itemIndex) => (
                                          <TableRow key={`${group.factura}-${itemIndex}`} className="hover:bg-slate-50">
                                            {detailColumns.map((column) => (
                                              <TableCell key={`${group.factura}-${itemIndex}-${column}`} className="py-3 align-top text-sm text-slate-700">
                                                {String(item[column] ?? '')}
                                              </TableCell>
                                            ))}
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
        <Button variant="secondary" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>
        <Button
          onClick={() => setStep((current) => Math.min(3, current + 1))}
          disabled={step === 1 ? !canContinueFromStep1 : step === 2 ? !canContinueFromStep2 : false}
        >
          {step < 3 ? 'Siguiente' : 'Finalizar'} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
