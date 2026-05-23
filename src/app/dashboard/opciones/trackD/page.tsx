'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { serviciosService } from '@/services/servicios.service';
import { Loader2, Search, FileText, Calendar, User, DollarSign, ArrowUpDown } from 'lucide-react';
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
}

export default function ConsultaRegistrosPage() {
  const [registros, setRegistros] = useState<RegistroFactura[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchRegistros();
  }, []);

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const resp = await serviciosService.getRegistrosFacturas();
      setRegistros(resp.data || []);
    } catch (error) {
      console.error("Error fetching registros:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const registrosFiltrados = registros.filter(r => 
    r.numeroRegistro.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.numeroFactura.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.codigoProveedor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-primary pl-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Consulta de Registros de Facturas</h1>
          <p className="text-muted-foreground text-lg">Historial de facturas procesadas y vinculadas a transportes.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por registro o factura..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-xl border-t-4 border-t-primary overflow-hidden">
        <CardHeader className="bg-muted/30">
          <CardTitle className="text-xl">Listado Maestro de Facturas</CardTitle>
          <CardDescription>Visualice los detalles de cada registro generado por el sistema.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground font-medium">Cargando registros...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">N° Registro Único</TableHead>
                    <TableHead className="font-bold">Proveedor</TableHead>
                    <TableHead className="font-bold">Factura</TableHead>
                    <TableHead className="font-bold">Fecha de Proceso</TableHead>
                    <TableHead className="font-bold text-right">Valor Total</TableHead>
                    <TableHead className="font-bold text-center">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic text-lg">
                        No se encontraron registros que coincidan con la búsqueda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    registrosFiltrados.map((item) => (
                      <TableRow key={item.id} className="hover:bg-primary/5 transition-colors group">
                        <TableCell className="font-black text-primary text-base">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-primary rounded-full group-hover:scale-y-125 transition-transform"></span>
                            {item.numeroRegistro}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{item.codigoProveedor}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-medium tracking-tighter">
                          {formatInvoice(item.numeroFactura)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {format(new Date(item.fechaRegistro), "dd 'de' MMMM, yyyy", { locale: es })}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase">
                              {format(new Date(item.fechaRegistro), "HH:mm 'hrs'")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-lg font-black text-primary">
                            ${item.valorTotal.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-green-600 hover:bg-green-700 px-3 py-1 font-bold uppercase tracking-wider text-[10px]">
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
      
      <div className="text-center text-xs text-muted-foreground mt-4">
        © {new Date().getFullYear()} Chaide - Sistema de Gestión de Gastos de Transportes
      </div>
    </div>
  );
}
