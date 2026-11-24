export const pages = {
  samples: '历史退修', plans: '训练方案', runs: '留出评估', tickets: '个案分派', audit: '值班日志',
};

export function current() {
  const [area, id] = location.hash.slice(1).split('/');
  return {area: Object.hasOwn(pages, area) ? area : 'samples', id: /^\d+$/.test(id) ? id : null};
}

export function go(area, id) {
  location.hash = id ? `${area}/${id}` : area;
}
