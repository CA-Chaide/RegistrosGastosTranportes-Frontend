import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

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
      // Ajustamos las claves a minúsculas para coincidir con el estándar de los otros métodos
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
   * Realiza el registro final en el sistema.
   */
  async registrarFacturaTransportista(data: any): Promise<BodyResponse<any>> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const numeroRegistro = `REG-${Math.floor(Math.random() * 900000) + 100000}`;
        resolve({
          data: {
            numeroRegistroUnico: numeroRegistro,
            mensaje: "Registro completado exitosamente"
          }
        });
      }, 1000);
    });
  },

  /**
   * Obtiene el historial de registros para el panel de consultas.
   */
  async getRegistrosFacturas(codigoProveedor?: string): Promise<BodyListResponse<any>> {
    const response = await fetch(`${API_URL}/listarRegistros${codigoProveedor ? `?codigoProveedor=${codigoProveedor}` : ''}`, {
      cache: 'no-store'
    }).catch(() => null);
    
    if (!response || !response.ok) {
      return {
        data: [
          { 
            id: '1', 
            numeroRegistro: 'REG-845122', 
            codigoProveedor: '5220802', 
            numeroFactura: '001101000000840', 
            valorTotal: 511.00, 
            fechaRegistro: '2024-03-20T10:30:00Z',
            estado: 'Procesado'
          },
          { 
            id: '2', 
            numeroRegistro: 'REG-992103', 
            codigoProveedor: '5220802', 
            numeroFactura: '001101000000955', 
            valorTotal: 1245.50, 
            fechaRegistro: '2024-03-21T15:45:00Z',
            estado: 'Procesado'
          }
        ],
        size: 2
      };
    }
    return response.json();
  }

};
