// Reglas de categorización para el mercado peruano
export const CATEGORY_RULES = [
  // Seguros
  { match: ['WARDA', 'WIN0000', 'PACISFD', 'PACI000', 'VECI000', '360P000', 'SEGURO DESGRAVAMEN'], category: 'Seguros', subcategory: 'Seguro', essential: true, recurring: true },
  // Deudas / Préstamos
  { match: ['PAGCRED EFEC BM', 'CUOTA DEL MES', 'CUOTAS DIFERIDAS', 'INTERESES', 'REGUL DEUDA'], category: 'Deudas', subcategory: 'Préstamo', essential: true, recurring: true },
  { match: ['INTERBANK', 'PAG.T.PROP.VISA', 'PAG.T.PROP.AMEX', 'PAG INTERBANK'], category: 'Deudas', subcategory: 'Tarjeta', essential: true, recurring: true },
  // Transporte
  { match: ['UBER', 'PYU*UBER', 'DLC*UBER', 'DLC*RIDES', 'GO COMBUSTIBLES', 'PETROCENTRO', 'MOBIL MART', 'SEGRISA GLP', 'GRIFO', 'COMBUSTIBLES', 'GASOLINA'], category: 'Transporte', subcategory: 'Movilidad', essential: true },
  // Delivery / Comida
  { match: ['RAPPI', 'DLC*RAPPI', 'JUSTO', 'MP*GETJUSTO', 'YC-GET JUSTO', 'YC-DLC*PEDIDOSYA', 'PEDIDOSYA'], category: 'Delivery', subcategory: 'Delivery', essential: false },
  // Restaurantes
  { match: ['FAUNA', 'RUSTICA', '7 SOPAS', 'MATAMBRITO', 'TIKI BAR', 'INDIO PIZZA', 'RESTAURANTE RODRIGO', 'LA CASA DE GLORIA', 'SIENNA BAKERY', 'OAKBERRY', 'ALANYA', 'TRICICLO', 'PRIMOS CHICKEN', 'BLANCO LATTE', 'EL ARTE', 'TONYS CAFE', 'LUCHA DIAGONAL', 'D TINTO Y BIFE'], category: 'Restaurantes', subcategory: 'Restaurante', essential: false },
  // Supermercados
  { match: ['VIVANDA', 'E WONG', 'EWONG', 'WONG', 'PLAZA VEA', '229 PVEA', 'LISTO', 'ECCO PLAZ', 'TOTTUS'], category: 'Supermercados', subcategory: 'Supermercado', essential: true },
  // Entretenimiento streaming
  { match: ['NETFLIX', 'SPOTIFY', 'CINEPLANET', 'CINEPOLIS', 'HAPPYLAND', 'CM LIVE', 'DISCOTECA', 'AMAREA'], category: 'Entretenimiento', subcategory: 'Ocio', essential: false },
  // Suscripciones
  { match: ['APPLE.COM/BILL', 'APPLE COM', 'DLC*RAPPI PRO', 'RAPPI PRO', 'MANTEN.TD.LAN', 'MEMBRESIA'], category: 'Suscripciones', subcategory: 'Suscripción', essential: false, recurring: true },
  { match: ['AMAZONPRIME', 'AMAZON PRIME', 'PRIME VIDEO'], category: 'Entretenimiento', subcategory: 'Streaming', essential: false, recurring: true },
  // Alquiler / Vivienda
  { match: ['REAL000000007673', 'ALQUILER', 'ARRENDAMIENTO', 'CONDOMINIO'], category: 'Alquiler', subcategory: 'Vivienda', essential: true, recurring: true },
  // Servicios básicos
  { match: ['PLUZ', 'ENEL', 'LUZ DEL SUR'], category: 'Servicios', subcategory: 'Luz', essential: true, recurring: true },
  { match: ['MOVI0', 'MOVISTAR', 'CLARO', 'ENTEL', 'BITEL'], category: 'Servicios', subcategory: 'Telefonía', essential: true, recurring: true },
  // Salud / Mascotas
  { match: ['SUPERPET', 'VETERINARIA', 'FARMACIA', 'CLINICA', 'HOSPITAL', 'BOTICA'], category: 'Mascotas', subcategory: 'Mascotas', essential: true },
  // Viajes
  { match: ['LATAM AIR', 'AVIANCA', 'SKY AIRLINE', 'LAN', 'HOTEL', 'SOUMA HOTEL', 'AIRBNB'], category: 'Viajes', subcategory: 'Viajes', essential: false },
  // Tecnología
  { match: ['GODADDY', 'AWS', 'MICROSOFT', 'GOOGLE'], category: 'Tecnología', subcategory: 'Tech', essential: false },
  // Compras
  { match: ['FALABELLA', 'OECHSLE', 'RIPLEY', 'SAGA', 'H&M'], category: 'Compras', subcategory: 'Retail', essential: false },
  // Hogar
  { match: ['PROMART', 'MAESTRO', 'SODIMAC', 'CLAUDIA LIVING'], category: 'Hogar', subcategory: 'Hogar', essential: false },
  // Transferencias
  { match: ['YAPE', 'PLIN', 'TRAN.CTAS'], category: 'Transferencias', subcategory: 'Transferencia', essential: false },
  // Sueldo
  { match: ['HABERES', 'SUELDO', '5TA.CCE'], category: 'Sueldo', subcategory: 'Ingreso', essential: false },
]

export type CategoryRule = typeof CATEGORY_RULES[0]

export function categorizeDescription(desc: string): { category: string, subcategory: string, recurring: boolean } {
  const upper = desc.toUpperCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.match.some(m => upper.includes(m.toUpperCase()))) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        recurring: rule.recurring ?? false,
      }
    }
  }
  return { category: 'Otros', subcategory: 'Otros', recurring: false }
}
