'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { serviciosService } from '@/services/servicios.service';
import { CheckCircle2, Trash2, Plus, Loader2, Info, RefreshCcw } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface TransportItem {
  id: string;
  numeroTransporte: string;
  numeroGasto: string;
  estatus: string;
  placa: string;
  valor: number;
}

export default function RegistroFacturasPage() {
  const { toast } = useToast();
  const transportInputRef = useRef<HTMLInputElement>(null);
  
  const [codigoProveedor, setCodigoProveedor] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [facturaValidada, setFacturaValidada] = useState(false);
  const [valorTotalFactura, setValorTotalFactura] = useState<number>(0);
  const [loadingFactura, setLoadingFactura] = useState(false);

  const [transporteActual, setTransporteActual] = useState('');
  const [listaTransportes, setListaTransportes] = useState<TransportItem[]>([]);
  const [loadingTransporte, setLoadingTransporte] = useState(false);

  const [loadingRegistro, setLoadingRegistro] = useState(false);
  const [registroCompletado, setRegistroCompletado] = useState<string | null>(null);

  const sumatoriaActual = listaTransportes.reduce((acc, item) => acc + item.valor, 0);
  const diferencia = valorTotalFactura - sumatoriaActual;

  const formatNumeroFactura = (raw: string) => {
    const soloDigitos = raw.replace(/\D/g, '').slice(0, 15);
    if (soloDigitos.length <= 3) return soloDigitos;
    return `${soloDigitos.slice(0, 3)}-${soloDigitos.slice(3)}`;
  };

  const handleNumeroFacturaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNumeroFactura(formatNumeroFactura(e.target.value));
  };

  const handleValidarFactura = async () => {
    const facturaRegex = /^\d{3}-\d{12}$/;
    const proveedorLimpio = codigoProveedor.trim();
    const facturaEntrada = numeroFactura.trim();

    if (!proveedorLimpio) {
      toast({ title: "Código requerido", description: "Ingrese el código del transportista.", variant: "destructive" });
      return;
    }

    if (!facturaRegex.test(facturaEntrada)) {
      toast({ title: "Formato inválido", description: "Use 000-000000000000.", variant: "destructive" });
      return;
    }

    setLoadingFactura(true);
    try {
      const facturaSinGuion = facturaEntrada.replace(/-/g, '');
      const resp = await serviciosService.consultaFacturaTransporte(proveedorLimpio, facturaSinGuion);
      
      const items = resp?.data || resp || [];
      if (Array.isArray(items) && items.length > 0) {
        const item = items[0];
        const total = parseFloat(item.Valor || item.VALOR || item.valor || item.monto || 0);
        
        if (total <= 0) {
          toast({ title: "Valor inválido", description: "La factura no tiene un monto procesable.", variant: "destructive" });
          return;
        }

        setValorTotalFactura(total);
        setFacturaValidada(true);
        toast({ title: "Factura validada", description: `Monto total: $${total.toFixed(2)}` });
      } else {
        toast({ title: "No encontrada", description: "Verifique código y factura.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Error en la consulta.", variant: "destructive" });
    } finally {
      setLoadingFactura(false);
    }
  };

  const handleAgregarTransporte = async () => {
    const valorABuscar = transporteActual.trim();
    const proveedor = codigoProveedor.trim();
    
    if (!valorABuscar) return;
    
    if (listaTransportes.find(t => t.numeroTransporte === valorABuscar)) {
      toast({ title: "Duplicado", description: `El transporte ${valorABuscar} ya está en la lista.`, variant: "destructive" });
      return;
    }

    setLoadingTransporte(true);
    try {
      const resp = await serviciosService.consultaTransporte(valorABuscar, proveedor);
      const items = resp?.data || resp || [];

      if (Array.isArray(items) && items.length > 0) {
        const item = items[0];
        
        const rawEstatus = item.Estatus || item.estado || item.ESTADO || item.estatus || 'A';
        const estatus = String(rawEstatus).toUpperCase();
        
        if (estatus === 'C') {
          toast({ title: "Concluido", description: `El transporte ${valorABuscar} ya está finalizado.`, variant: "destructive" });
          setLoadingTransporte(false);
          return;
        }

        const itemValor = parseFloat(item.valorGasto || item.ValorGasto || item.VALOR || item.valor || item.Monto || 0);
        
        const gasto = item.NumeroGasto || item.numeroGasto || item.Gasto || item.GASTO || item.num_gasto || item.NUMERO_GASTO || item.secuencia || 'N/A';
        const placa = item.Placa || item.placa || item.PLACA || item.Vehiculo || item.vehiculo || item.VEHICULO || item.PlacaVehiculo || item.placa_vehiculo || item.Matricula || 'N/A';

        const nuevoTransporte: TransportItem = {
          id: crypto.randomUUID(),
          numeroTransporte: valorABuscar, 
          numeroGasto: String(gasto),
          estatus: estatus,
          placa: String(placa),
          valor: itemValor
        };

        setListaTransportes(prev => [...prev, nuevoTransporte]);
        setTransporteActual('');
        
        if (transportInputRef.current) transportInputRef.current.focus();
        
        toast({ title: "Agregado", description: `Transporte ${valorABuscar} vinculado.` });
      } else {
        toast({ 
          title: "No encontrado", 
          description: "El número que se ingresó ya se encuentra ingresado en otra factura.", 
          variant: "destructive" 
        });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Error en consulta.", variant: "destructive" });
    } finally {
      setLoadingTransporte(false);
    }
  };

  const handleFinalizarRegistro = async () => {
    if (Math.abs(diferencia) > 0.01) {
      toast({ title: "Descuadre", description: "La sumatoria debe coincidir con el total de la factura.", variant: "destructive" });
      return;
    }

    setLoadingRegistro(true);
    try {
      const resp = await serviciosService.registrarFacturaTransportista({
        codigoProveedor: codigoProveedor.trim(),
        numeroFactura: numeroFactura.trim().replace(/-/g, ''),
        valorTotalFactura,
        items: listaTransportes
      });
      
      const numeroRegistro = resp.data?.numeroRegistroUnico || resp.numeroRegistroUnico;
      setRegistroCompletado(numeroRegistro);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Error al procesar el registro.", variant: "destructive" });
    } finally {
      setLoadingRegistro(false);
    }
  };

  const resetForm = () => {
    setCodigoProveedor('');
    setNumeroFactura('');
    setFacturaValidada(false);
    setValorTotalFactura(0);
    setListaTransportes([]);
    setRegistroCompletado(null);
    setTransporteActual('');
  };

  if (registroCompletado) {
    const [prefix, num] = registroCompletado.includes('-') ? registroCompletado.split('-') : ['REG', registroCompletado];
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card className="border-green-200 bg-green-50 shadow-2xl animate-in zoom-in-95 duration-300">
          <CardContent className="pt-10 pb-10 flex flex-col items-center text-center">
            <div className="bg-green-100 p-6 rounded-full mb-6 shadow-inner">
              <CheckCircle2 className="h-20 w-20 text-green-600" />
            </div>
            <CardTitle className="text-4xl font-black text-green-900 tracking-tight">¡REGISTRO EXITOSO!</CardTitle>
            <div className="mt-8 p-10 bg-white rounded-3xl border-4 border-dashed border-green-200 w-full shadow-lg">
              <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Número de Registro Único</p>
              <div className="flex flex-col items-center">
                <p className="text-5xl font-black text-primary leading-none tracking-tighter uppercase">{prefix}-</p>
                <p className="text-7xl font-black text-primary leading-none tracking-tighter mt-1">{num}</p>
              </div>
            </div>
            <Button onClick={resetForm} className="mt-12 px-10 py-8 text-xl font-bold rounded-2xl shadow-xl">
              Realizar nuevo registro
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 border-l-8 border-primary pl-6 py-2">
        <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Módulo de Registro de Gastos</h1>
        <p className="text-muted-foreground text-xl font-medium">Gestión de facturas de transporte.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className={`lg:col-span-4 h-fit transition-all duration-500 shadow-xl ${facturaValidada ? "bg-muted/40 border-primary/30" : "border-t-4 border-t-primary"}`}>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-3">
              <span className="bg-primary text-white w-9 h-9 rounded-xl flex items-center justify-center text-lg font-black shadow-lg">1</span>
              Validación de Factura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="codigo" className="font-bold text-sm uppercase tracking-wide">Código Proveedor</Label>
              <Input id="codigo" placeholder="Ej: 5220802" value={codigoProveedor} disabled={facturaValidada} onChange={(e) => setCodigoProveedor(e.target.value)} className="text-xl py-6 font-semibold" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="factura" className="font-bold text-sm uppercase tracking-wide">Número de Factura</Label>
              <Input id="factura" placeholder="000-000000000000" value={numeroFactura} disabled={facturaValidada} onChange={handleNumeroFacturaChange} inputMode="numeric" maxLength={16} className="text-xl py-6 font-mono tracking-widest" />
            </div>
            {!facturaValidada ? (
              <Button className="w-full py-8 text-xl font-black shadow-2xl" onClick={handleValidarFactura} disabled={loadingFactura}>
                {loadingFactura && <Loader2 className="mr-3 h-6 w-6 animate-spin" />}
                VALIDAR FACTURA
              </Button>
            ) : (
              <div className="bg-white p-6 rounded-2xl border-2 border-primary/20 space-y-3 shadow-inner">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Valor de Factura</span>
                <div className="flex justify-between items-end">
                  <span className="text-4xl font-black text-primary tracking-tighter">${valorTotalFactura.toFixed(2)}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setFacturaValidada(false); setListaTransportes([]); }} className="text-xs font-bold text-destructive underline">Cambiar</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`lg:col-span-8 shadow-2xl transition-all duration-700 ${!facturaValidada ? "opacity-30 blur-[1px] pointer-events-none grayscale" : "opacity-100 border-t-4 border-t-green-500"}`}>
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 px-8 py-6">
            <CardTitle className="text-2xl flex items-center gap-3">
              <span className="bg-green-600 text-white w-9 h-9 rounded-xl flex items-center justify-center text-lg font-black shadow-lg">2</span>
              Detalle de Transportes
            </CardTitle>
            <div className="text-right">
               <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Sumatoria</span>
               <p className="text-3xl font-black text-primary tracking-tighter">${sumatoriaActual.toFixed(2)}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-8 px-8">
            <div className="flex gap-4">
              <Input 
                ref={transportInputRef}
                placeholder="Ingrese Transporte y presione Enter" 
                value={transporteActual}
                disabled={loadingTransporte}
                onChange={(e) => setTransporteActual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAgregarTransporte();
                  }
                }}
                className="text-xl py-7 shadow-sm border-2 font-bold"
              />
              <Button onClick={handleAgregarTransporte} disabled={loadingTransporte || !transporteActual.trim()} className="px-8 h-auto text-lg font-bold">
                {loadingTransporte ? <Loader2 className="h-6 w-6 animate-spin" /> : <Plus className="h-6 w-6" />}
              </Button>
            </div>

            <div className="border-2 rounded-2xl overflow-hidden bg-white shadow-xl">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-black text-xs uppercase">Transporte</TableHead>
                    <TableHead className="font-black text-xs uppercase">Gasto</TableHead>
                    <TableHead className="font-black text-xs uppercase">Placa</TableHead>
                    <TableHead className="font-black text-xs uppercase">Estatus</TableHead>
                    <TableHead className="text-right font-black text-xs uppercase">Monto</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listaTransportes.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium">No hay transportes ingresados.</TableCell></TableRow>
                  ) : (
                    listaTransportes.map((item) => (
                      <TableRow key={item.id} className="hover:bg-primary/5 group">
                        <TableCell className="font-black text-primary text-lg">{item.numeroTransporte}</TableCell>
                        <TableCell className="font-bold text-muted-foreground">{item.numeroGasto}</TableCell>
                        <TableCell className="font-black text-gray-800">{item.placa}</TableCell>
                        <TableCell>
                          <Badge className={item.estatus === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                            {item.estatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-black text-xl tracking-tighter">${item.valor.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setListaTransportes(listaTransportes.filter(t => t.id !== item.id))}><Trash2 className="h-5 w-5" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className={`flex flex-col md:flex-row justify-between items-center p-8 rounded-3xl border-4 border-dashed transition-all ${Math.abs(diferencia) < 0.01 && listaTransportes.length > 0 ? "bg-green-50 border-green-300" : "bg-muted/40 border-muted-foreground/20"}`}>
              <div className="space-y-2">
                {Math.abs(diferencia) > 0.01 ? (
                  <p className="text-2xl font-black text-destructive tracking-tighter">Diferencia: ${diferencia.toFixed(2)}</p>
                ) : listaTransportes.length > 0 ? (
                  <p className="text-3xl font-black text-green-600 flex items-center gap-2"><CheckCircle2 className="h-8 w-8" /> MONTOS CUADRADOS</p>
                ) : (
                   <p className="text-muted-foreground font-medium italic">Esperando ingreso de datos...</p>
                )}
              </div>
              <Button size="lg" className="py-10 px-12 text-2xl font-black shadow-2xl rounded-2xl" disabled={Math.abs(diferencia) > 0.01 || listaTransportes.length === 0 || loadingRegistro} onClick={handleFinalizarRegistro}>
                {loadingRegistro ? <Loader2 className="mr-3 h-8 w-8 animate-spin" /> : "FINALIZAR"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
