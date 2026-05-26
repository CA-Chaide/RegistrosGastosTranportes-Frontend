import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL_RGT}/api/servicios`;
const STORAGE_KEY = 'RGT_LOCAL_REGISTROS';

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
   * Realiza el registro final en el sistema y persiste localmente para el prototipo.
   */
  async registrarFacturaTransportista(data: any): Promise<BodyResponse<any>> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const numeroRegistro = `REG-${Math.floor(Math.random() * 900000) + 100000}`;
        const now = new Date().toISOString();

        // Convertir los items de la factura en registros individuales para el dashboard
        const nuevosRegistros = data.items.map((item: any) => ({
          id: crypto.randomUUID(),
          numeroRegistro: numeroRegistro,
          codigoProveedor: data.codigoProveedor,
          numeroFactura: data.numeroFactura,
          numeroGasto: item.numeroGasto,
          transporte: item.numeroTransporte,
          valorTotal: item.valor,
          fechaRegistro: now,
          estado: 'Procesado'
        }));

        // Guardar en localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        const currentList = stored ? JSON.parse(stored) : [];
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...nuevosRegistros, ...currentList]));

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
   * Obtiene el historial de registros combinando datos locales y remotos.
   */
  async getRegistrosFacturas(codigoProveedor?: string): Promise<BodyListResponse<any>> {
    // Intentar obtener de la API
    const response = await fetch(`${API_URL}/listarRegistros${codigoProveedor ? `?codigoProveedor=${codigoProveedor}` : ''}`, {
      cache: 'no-store'
    }).catch(() => null);
    
    let remoteData = [];
    if (response && response.ok) {
      const json = await response.json();
      remoteData = json.data || [];
    } else {
      // Datos de ejemplo si la API falla
      const now = new Date().toISOString();
      remoteData = [
        { 
          id: '1', 
          numeroRegistro: 'REG-845122', 
          codigoProveedor: '5220802', 
          numeroFactura: '001-001-0000840', 
          numeroGasto: 'G-10294',
          transporte: '0000534650',
          valorTotal: 511.00, 
          fechaRegistro: now,
          estado: 'Procesado'
        },
        { 
          id: '2', 
          numeroRegistro: 'REG-992103', 
          codigoProveedor: '5220802', 
          numeroFactura: '001-001-0000955', 
          numeroGasto: 'G-10295',
          transporte: '0000534651',
          valorTotal: 1245.50, 
          fechaRegistro: now,
          estado: 'Procesado'
        }
      ];
    }

    // Obtener datos guardados localmente
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    const localData = stored ? JSON.parse(stored) : [];

    // Combinar y filtrar por proveedor si es necesario
    let combined = [...localData, ...remoteData];
    if (codigoProveedor) {
      combined = combined.filter(r => r.codigoProveedor === codigoProveedor);
    }

    return {
      data: combined,
      size: combined.length
    };
  }

};