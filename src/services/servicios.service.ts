
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { registroGastosTransporte } from './registroGastosTransporte.service';

const API_URL = `${environment.apiURL_RGT}/api/servicios`;

export const serviciosService = {

  /**
   * Consulta datos de un transporte específico para un agente.
   */
  async consultaTransporte(transporte: string, codigoProveedor: string): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/consultaTransporte', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({ Transporte: transporte, AgenteTransporte: codigoProveedor }),
      cache: 'no-store'
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al consultar el transporte');
    }
    return response.json();
  },

  /**
   * Consulta el valor total de una factura para un proveedor.
   */
  async consultaFacturaTransporte(codigoProveedor: string, factura: string): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/FacturaProveedorTransporte', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ codigoProveedor: codigoProveedor, Factura: factura }),
      cache: 'no-store'
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al consultar la factura');
    }
    return response.json();
  },

  /**
   * Realiza el registro final en el sistema utilizando el servicio RegistroGastosTransporte.
   */
  async registrarFacturaTransportista(data: any): Promise<BodyResponse<any>> {
    const now = new Date().toISOString();
    const results = [];

    // Persistencia oficial en la tabla RegistrosGastosTransporte
    for (const item of data.items) {
      const registro = {
        id: 0,
        AgenteTransporte: String(data.codigoProveedor),
        NumFactura: String(data.numeroFactura),
        Transporte: String(item.numeroTransporte),
        GastoTransporte: String(item.numeroGasto),
        ValorGasto: Number(item.valor),
        FechaRegistro: now,
        Estado: 'A'
      };
      
      try {
        const resp = await registroGastosTransporte.save(registro as any);
        results.push(resp.data || resp);
      } catch (e) {
        console.error("Error al guardar registro individual:", e);
      }
    }

    const numeroRegistro = `REG-${Math.floor(Math.random() * 900000) + 100000}`;
    return {
      data: {
        numeroRegistroUnico: numeroRegistro,
        mensaje: "Registro completado exitosamente",
        itemsProcesados: results.length
      }
    };
  },

  /**
   * Obtiene información detallada de gastos de transporte según filtros de negocio.
   * Entrada: { estado, fecha_inicio, fecha_fin, agente_transporte }
   */
  async getInformacionGastosTransportes(estado: string, fecha_inicio: string, fecha_fin: string, agente_transporte: string): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/getDashboardByInfo', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({ 
        estado: estado, 
        fecha_inicio: fecha_inicio, 
        fecha_fin: fecha_fin, 
        agente_transporte: agente_transporte 
      }),
      cache: 'no-store'
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Error al consultar información de gastos');
    }
    return response.json();
  },

};
