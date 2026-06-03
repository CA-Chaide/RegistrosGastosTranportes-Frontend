
'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { registroGastosTransporte } from '@/services/registroGastosTransporte.service';
import { Loader2, Search, User, ChevronDown, ChevronRight, Package, ReceiptText, Hash, DollarSign, X, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  estadoGasto?: string;
}

interface GrupoRegistro {
  keyFactura: string;
  numeroRegistro: string;
  codigoProveedor: string;
  numeroFactura: string;
  fechaRegistro: string;
  estado: string;
  valorTotalAcumulado: number;
  items: RegistroFactura[];
}

export default function ConsultaRegistrosPage() {
  const [registros, setRegistros] = useState<RegistroFactura[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchRegistros();
  }, []);

  const getRobustValue = (obj: any, keys: string[]) => {
    if (!obj) return undefined;
    const objKeys = Object.keys(obj);
    for (const key of keys) {
      const foundKey = objKeys.find(k => k.toLowerCase() === key.toLowerCase());
      if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== null && obj[foundKey] !== '') {
        return obj[foundKey];
      }
    }
    return undefined;
  };

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const storedUser = localStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      const proveedorId = String(user?.usuario || user?.codigo_usuario || '');
      
      const resp = await registroGastosTransporte.getAll();
      const rawData = resp.data || [];
      
      const mappedData: RegistroFactura[] = rawData
        .filter((item: any) => {
          const itemProv = String(getRobustValue(item, ['AgenteTransporte', 'codigoProveedor', 'proveedor']) || '');
          return proveedorId ? itemProv.includes(proveedorId) || proveedorId.includes(itemProv) : true;
        })
        .map((item: any, idx: number) => {
          const valRaw = getRobustValue(item, ['ValorGasto', 'valor', 'monto', 'total', 'montoRubro']);
          const valNumeric = typeof valRaw === 'string' ? parseFloat(valRaw.replace(',', '.')) : Number(valRaw || 0);
          
          const gasto = getRobustValue(item, ['GastoTransporte', 'NumGasto', 'numeroGasto', 'gasto', 'secuencia']);
          const transporte = getRobustValue(item, ['Transporte', 'numeroTransporte', 'vehiculo', 'matricula']);
          const factura = getRobustValue(item, ['NumFactura', 'factura', 'referencia', 'numeroFactura']);
          const estGasto = getRobustValue(item, ['Estado', 'estado_gasto', 'status']);

          return {
            id: String(item.id || idx),
            numeroRegistro: String(getRobustValue(item, ['id', 'numeroRegistro']) || 'REG-' + idx),
            codigoProveedor: String(getRobustValue(item, ['AgenteTransporte', 'proveedor']) || proveedorId),
            numeroFactura: String(factura || ''),
            valorTotal: valNumeric,
            fechaRegistro: item.FechaRegistro || new Date().toISOString(),
            estado: item.Estado || 'A',
            numeroGasto: String(gasto || 'N/A'),
            transporte: String(transporte || 'N/A'),
            estadoGasto: String(estGasto || 'N/A')
          };
        });
      
      setRegistros(mappedData);
    } catch (error) {
      console.error("Error fetching registros:", error);
    } finally {
      setLoading(false);
    }
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

  const formatInvoice = (val: string) => {
    if (!val || val === 'N/A') return 'N/A';
    if (val.includes('-')) return val;
    const clean = val.replace(/\D/g, '');
    if (clean.length >= 13) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    return clean;
  };

  const groupedRegistros = useMemo(() => {
    const groups: Record<string, GrupoRegistro> = {};
    registros.forEach(reg => {
      const key = reg.numeroFactura;
      if (!groups[key]) {
        groups[key] = {
          keyFactura: key,
          numeroRegistro: reg.numeroRegistro || 'N/A',
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

    const list = Object.values(groups).sort((a, b) => new Date(b.fechaRegistro).getTime() - new Date(a.fechaRegistro).getTime());
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().replace(/-/g, '');
    return list.filter(g => g.numeroFactura.toLowerCase().replace(/-/g, '').includes(term));
  }, [registros, searchTerm]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-8 border-primary pl-6 py-2">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Listado Maestro de Gastos</h1>
          <p className="text-muted-foreground text-xl font-medium">Historial consolidado por Factura y Gasto Operativo.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/60" />
          <Input placeholder="BUSCAR POR FACTURA..." className="pl-12 pr-10 h-14 text-lg border-2 border-primary/20 rounded-2xl font-bold uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <Card className="shadow-2xl border-none rounded-3xl overflow-hidden border-t-4 border-t-primary">
        <CardHeader className="bg-muted/30 px-8 py-6">
          <CardTitle className="text-2xl font-black text-primary uppercase tracking-tight">Base de Datos de Facturación</CardTitle>
          <CardDescription className="text-base font-medium">Haga clic en una factura para desglosar sus transportes y gastos asociados.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6"><Loader2 className="h-14 w-14 animate-spin text-primary opacity-50" /><p className="text-muted-foreground font-black text-sm uppercase tracking-[0.3em]">Cargando base de datos...</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50 border-b-2">
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-widest text-gray-500 py-6">Factura</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-widest text-gray-500">Referencia de Registro</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-widest text-gray-500">Proveedor</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-widest text-gray-500 text-center">Fecha de Proceso</TableHead>
                    <TableHead className="text-right font-black text-xs uppercase tracking-widest text-gray-500 px-8">Valor Total</TableHead>
                    <TableHead className="text-center font-black text-xs uppercase tracking-widest text-gray-500 px-8">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedRegistros.map((grupo) => {
                    const isExpanded = expandedRows.has(grupo.keyFactura);
                    return (
                      <React.Fragment key={grupo.keyFactura}>
                        <TableRow className={cn("hover:bg-primary/5 cursor-pointer", isExpanded && "bg-primary/5")} onClick={() => toggleRow(grupo.keyFactura)}>
                          <TableCell className="text-center">{isExpanded ? <ChevronDown className="h-6 w-6 text-primary" /> : <ChevronRight className="h-6 w-6 text-muted-foreground" />}</TableCell>
                          <TableCell className="font-black text-gray-900 tabular-nums text-lg py-6">{formatInvoice(grupo.numeroFactura)}</TableCell>
                          <TableCell><span className="font-black text-primary text-base uppercase tracking-tight">{grupo.numeroRegistro}</span></TableCell>
                          <TableCell><div className="flex items-center gap-2"><div className="bg-muted p-2 rounded-xl"><User className="h-4 w-4 text-primary" /></div><span className="font-black text-gray-700 text-sm">{grupo.codigoProveedor}</span></div></TableCell>
                          <TableCell className="text-center font-black text-xs">{format(new Date(grupo.fechaRegistro), "dd/MM/yyyy")}</TableCell>
                          <TableCell className="text-right px-8"><span className="text-2xl font-black text-primary">${grupo.valorTotalAcumulado.toFixed(2)}</span></TableCell>
                          <TableCell className="text-center px-8">
                            <Badge className={cn("px-4 py-1 font-black uppercase text-[10px] tracking-widest", grupo.estado.toUpperCase() === 'PROCESADO' || grupo.estado.toUpperCase() === 'A' ? "bg-green-600" : "bg-orange-500")}>{grupo.estado}</Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="bg-muted/40 animate-in slide-in-from-left-2 duration-300">
                            <TableCell colSpan={7} className="p-0">
                              <div className="p-8 space-y-4">
                                <div className="flex items-center gap-2 mb-2"><Package className="h-5 w-5 text-primary" /><h4 className="text-sm font-black uppercase tracking-widest text-primary">Desglose de Operaciones</h4></div>
                                <div className="bg-white rounded-2xl border-2 border-primary/10 overflow-hidden shadow-inner">
                                  <Table>
                                    <TableHeader className="bg-muted/50">
                                      <TableRow><TableHead className="font-black text-[10px] uppercase py-3 pl-8">N° Transporte</TableHead><TableHead className="font-black text-[10px] uppercase text-center">N° Gasto del Transporte</TableHead><TableHead className="font-black text-[10px] uppercase text-center">Estado Gasto</TableHead><TableHead className="font-black text-[10px] uppercase text-right pr-8">Valor del Transporte</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {grupo.items.map((item) => (
                                        <TableRow key={item.id} className="hover:bg-primary/5">
                                          <TableCell className="py-4 pl-8 font-bold text-gray-600"><div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 opacity-50" />{item.transporte || 'N/A'}</div></TableCell>
                                          <TableCell className="text-center"><div className="inline-flex items-center gap-2 bg-muted/50 px-3 py-1 rounded-full font-black text-primary text-sm"><Hash className="h-3 w-3" />{item.numeroGasto || 'N/A'}</div></TableCell>
                                          <TableCell className="text-center"><div className="inline-flex items-center gap-2 text-primary"><ShieldCheck className="h-3.5 w-3.5 opacity-50" /><span className="text-xs font-bold uppercase">{item.estadoGasto || 'N/A'}</span></div></TableCell>
                                          <TableCell className="text-right pr-8 font-black text-lg text-gray-900">${item.valorTotal.toFixed(2)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
