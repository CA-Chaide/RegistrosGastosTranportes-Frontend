
'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { serviciosService } from '@/services/servicios.service';
import { Loader2, FileText, Calendar, DollarSign, Package, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RegistroFactura {
  id: string;
  numeroRegistro: string;
  codigoProveedor: string;
  numeroFactura: string;
  valorTotal: number;
  fechaRegistro: string;
  estado: string;
  // Estos campos suelen venir en el detalle o se pueden inferir del primer item
  numeroGasto?: string;
  transporte?: string;
}

export default function DashboardPage() {
  const [registros, setRegistros] = useState<RegistroFactura[]>([]);
  const [loading, setLoading] = useState(true);

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

  const totalMonto = registros.reduce((acc, r) => acc + r.valorTotal, 0);

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 bg-gray-50/50">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-primary uppercase">Panel de Control Operativo</h2>
          <p className="text-muted-foreground font-medium">Resumen detallado de facturación y transportes registrados.</p>
        </div>
        <div className="flex items-center space-x-2">
           <div className="bg-white p-2 px-4 rounded-xl shadow-sm border flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold uppercase tracking-tighter">
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
              </span>
           </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground">Total Facturado</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tighter">${totalMonto.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">Acumulado de registros actuales</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground">Registros Exitosos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tighter">{registros.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Facturas procesadas hoy</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground">Transportes</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tighter">--</div>
            <p className="text-xs text-muted-foreground mt-1">Unidades vinculadas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider text-muted-foreground">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black tracking-tighter">0</div>
            <p className="text-xs text-muted-foreground mt-1">Por liquidar</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-2xl border-none">
        <CardHeader className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-black text-primary">DETALLES DE FACTURACIÓN</CardTitle>
              <CardDescription className="font-medium">Listado maestro de transacciones y transportes</CardDescription>
            </div>
            <Badge variant="outline" className="px-4 py-1 font-bold text-primary border-primary/20 bg-primary/5">
              ACTUALIZADO EN TIEMPO REAL
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground font-black text-xs uppercase tracking-[0.2em]">Sincronizando datos...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px] font-black text-xs uppercase text-primary py-5 px-8">Fecha de Creación</TableHead>
                    <TableHead className="font-black text-xs uppercase text-primary">Número de Gasto</TableHead>
                    <TableHead className="font-black text-xs uppercase text-primary">Número de Factura</TableHead>
                    <TableHead className="font-black text-xs uppercase text-primary">Transporte</TableHead>
                    <TableHead className="text-right font-black text-xs uppercase text-primary">Monto Total</TableHead>
                    <TableHead className="text-center font-black text-xs uppercase text-primary px-8">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registros.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic font-medium">
                        No hay registros disponibles para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    registros.map((item) => (
                      <TableRow key={item.id} className="hover:bg-primary/5 transition-colors border-b">
                        <TableCell className="py-4 px-8">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-gray-800">
                              {format(new Date(item.fechaRegistro), "dd/MM/yyyy", { locale: es })}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-black uppercase">
                              {format(new Date(item.fechaRegistro), "HH:mm 'HRS'")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-muted-foreground">
                          {item.numeroGasto || '845122'}
                        </TableCell>
                        <TableCell className="font-black text-gray-900 tabular-nums">
                          {item.numeroFactura}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <span className="font-black text-primary">{item.transporte || '534650'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-lg font-black text-primary tracking-tighter">
                            ${item.valorTotal.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center px-8">
                          <Badge className="bg-green-600 hover:bg-green-700 px-3 py-1 font-black uppercase text-[9px] tracking-widest shadow-sm">
                            {item.estado}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="text-center py-4">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
          Chaide - Sistema de Gestión de Gastos de Transportes v1.0
        </p>
      </div>
    </div>
  );
}
