function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

export function filterPendingTramites(items, filters) {
  const query = normalize(filters.query).trim();

  return items.filter((item) => {
    const searchable = [
      item.nombres,
      item.apellidos,
      item.ci,
      item.ci_exp,
      item.telefono,
      item.numero_carnet_fisico,
      item.codigo_carnet,
      item.tipo_tramite,
      item.ocupacion,
      item.empresa_trabajo,
      item.mercado,
    ].map(normalize);

    if (query && !searchable.some((value) => value.includes(query))) return false;
    if (filters.tipo && normalize(item.tipo_tramite) !== normalize(filters.tipo)) return false;
    if (filters.ocupacion && normalize(item.ocupacion) !== normalize(filters.ocupacion)) return false;
    if (filters.mercado && normalize(item.mercado) !== normalize(filters.mercado)) return false;

    const fecha = String(item.fecha_inicio ?? '').slice(0, 10);
    if (filters.desde && (!fecha || fecha < filters.desde)) return false;
    if (filters.hasta && (!fecha || fecha > filters.hasta)) return false;

    return true;
  });
}
