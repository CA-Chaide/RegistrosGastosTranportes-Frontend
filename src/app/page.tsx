'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { authService } from '@/services/auth.service';
import { tipoUsuarioAplicacionService } from '@/services/tipoUsuarioAplicacion.service';
import { environment } from '@/environments/environments.prod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function ChaideLogo() {
  return (
    <div className="flex flex-col items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <Image
          src={`${environment.basePath}/img/logo_chaide.svg`}
          alt="Chaide Logo"
          width={300}
          height={300}
          priority
        />
      </div>
    </div>
  );
}

const initialState = {
  success: false,
  message: '',
};

function SubmitButton({ pending }: { pending: boolean }) {
    return (
        <Button type="submit" className="w-full py-6 text-lg font-bold" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Validando...
              </>
            ) : 'Ingresar al Sistema'}
        </Button>
    );
}

export default function LoginPage() {
    const [state, setState] = useState(initialState);
    const [pending, setPending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setPending(true);
        setState(initialState);
        
        const formData = new FormData(e.currentTarget);
        const email = formData.get('usuario');
        const password = formData.get('password');
        
        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
            setState({ success: false, message: 'Usuario y contraseña son requeridos.' });
            setPending(false);
            return;
        }

        try {
            const response = await authService.login({ email, password });

            // Extracción multinivel del token y datos
            const getVal = (obj: any, path: string[]) => path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
            
            const token = getVal(response, ['token']) || getVal(response, ['data', 'token']) || getVal(response, ['data', 'data', 'token']);
            const user = getVal(response, ['user']) || getVal(response, ['data', 'user']) || getVal(response, ['data', 'data', 'user']);
            const perfiles = getVal(response, ['perfiles']) || getVal(response, ['data', 'perfiles']) || getVal(response, ['user', 'perfiles']) || getVal(response, ['data', 'user', 'perfiles']);
            const message = getVal(response, ['message']) || getVal(response, ['data', 'message']);

            if (token) {
                const perfilesArray: any[] = Array.isArray(perfiles) ? perfiles : (perfiles ? [perfiles] : []);
                
                if (perfilesArray.length === 0) {
                    setState({ success: false, message: 'El usuario no tiene perfiles asignados en el sistema.' });
                    setPending(false);
                    return;
                }

                const authorizedProfiles: any[] = [];
                const targetApp = environment.nombreAplicacion;

                // Validación de acceso por aplicación
                for (const perfil of perfilesArray) {
                    const codigo = perfil?.codigo_tipo_usuario || perfil?.codigoTipoUsuario || perfil?.codigo || perfil?.id;
                    if (!codigo) continue;

                    try {
                        const resp = await tipoUsuarioAplicacionService.getByCodigoTipoUsuario(String(codigo));
                        const items: any[] = Array.isArray(resp?.data) ? resp.data : (resp?.data ? [resp.data] : []);
                        
                        for (const item of items) {
                            const codigoApp = item?.codigo_aplicacion || item?.aplicacion?.codigo_aplicacion;
                            const nombreApp = item?.nombre_aplicacion || item?.aplicacion?.nombre_aplicacion;
                            
                            if (codigoApp === targetApp || nombreApp === targetApp) {
                                if (!authorizedProfiles.some(p => (p.codigo_tipo_usuario || p.id) === codigo)) {
                                    authorizedProfiles.push(perfil);
                                }
                                break;
                            }
                        }
                    } catch (e) {
                        console.error(`Error validando perfil ${codigo}:`, e);
                    }
                }

                if (authorizedProfiles.length === 0) {
                    setState({ success: false, message: `No tienes permisos para acceder a: ${targetApp}` });
                    setPending(false);
                    return;
                }

                // Persistencia de sesión
                localStorage.setItem('token', token);
                if (user) localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('perfilesAutorizados', JSON.stringify(authorizedProfiles));

                window.location.href = `${environment.basePath}/dashboard`;
                return;
            }

            setState({
                success: false,
                message: message || 'Credenciales incorrectas o usuario no encontrado.',
            });
        } catch (error: any) {
            setState({ 
                success: false, 
                message: error.message || 'Error de conexión con el servidor de autenticación.' 
            });
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh] bg-background">
            <div className="flex items-center justify-center py-12 bg-primary lg:bg-primary shadow-inner">
                <ChaideLogo />
            </div>
            <div className="flex items-center justify-center py-12 px-6">
                <Card className="mx-auto max-w-sm w-full shadow-2xl border-t-4 border-primary">
                    <CardHeader className="text-center pb-2">
                        <div className="flex justify-center items-center gap-3 mb-4">
                            <Image
                                src={`${environment.basePath}/img/Chide.svg`}
                                alt="Chaide Logo"
                                width={50}
                                height={50}
                                priority
                            />
                            <CardTitle className="text-3xl font-black tracking-tighter text-primary">CHAIDE</CardTitle>
                        </div>
                        <CardDescription className="font-medium text-base">
                            Módulo de Gastos de Transportes
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-5 pt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="usuario" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Usuario / Correo</Label>
                                    <Input id="usuario" name="usuario" placeholder="usuario@chaide.com" required className="py-6" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Contraseña</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            name="password"
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="••••••••"
                                            required
                                            className="py-6"
                                        />
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                                            onClick={() => setShowPassword((v) => !v)}
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                {state && !state.success && state.message && (
                                    <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle className="font-bold">Acceso Denegado</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            {state.message}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                <SubmitButton pending={pending} />
                                <p className="text-center text-[10px] text-muted-foreground uppercase font-medium tracking-tight mt-6">
                                  Si tiene problemas de acceso, contacte a soporte técnico.
                                </p>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
