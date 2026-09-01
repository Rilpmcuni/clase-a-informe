"use client";

import { create } from "zustand";

interface EstadoReproductor {
  tiempo: number;
  seekPendiente: number | null;
  setTiempo: (t: number) => void;
  pedirSeek: (t: number) => void;
  consumirSeek: () => void;
}

export const useReproductor = create<EstadoReproductor>((set) => ({
  tiempo: 0,
  seekPendiente: null,
  setTiempo: (tiempo) => set({ tiempo }),
  pedirSeek: (t) => set({ seekPendiente: t }),
  consumirSeek: () => set({ seekPendiente: null }),
}));

interface EstadoAdjuntosChat {
  seleccion: string;
  captura: string | null;
  minutoCaptura: number;
  setSeleccion: (s: string) => void;
  setCaptura: (dataUrl: string, minuto: number) => void;
  limpiarAdjuntos: () => void;
}

export const useAdjuntosChat = create<EstadoAdjuntosChat>((set) => ({
  seleccion: "",
  captura: null,
  minutoCaptura: 0,
  setSeleccion: (seleccion) => set({ seleccion }),
  setCaptura: (captura, minutoCaptura) => set({ captura, minutoCaptura }),
  limpiarAdjuntos: () => set({ seleccion: "", captura: null }),
}));
