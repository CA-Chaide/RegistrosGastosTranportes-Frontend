
import type { MenuTipoUsuario } from "@/types/interfaces";
import type { BodyListResponse } from "@/types/body-list-response";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";

const API_URL = `${environment.apiURL_RGT}/api/servicios`;

export const serviciosService = {

  async consultaTransporte(transporte: string, agenteTransporte: string): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/consultaTransporte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Transporte: transporte, AgenteTransporte: agenteTransporte }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save menu-tipo-usuario');
    }
    return response.json();
  },

  async consultaFacturaTransporte(codigoProveedor: string, factura: string): Promise<BodyListResponse<any>> {
    const response = await fetch(API_URL + '/FacturaProveedorTransporte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoProveedor: codigoProveedor, Factura: factura }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(errorBody.message || 'Failed to save menu-tipo-usuario');
    }
    return response.json();
  },

};
