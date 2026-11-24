import {routes, soles} from '../constants/domain.js';
import {escape as h} from '../utils/text.js';
import {selectOptions} from './common/ui.js';

export function recordFields(row = {}, sample = false) {
  return `<div class="form-grid">
    <label>工票编号<input name="code" required value="${h(row.code)}" pattern="[A-Z0-9][A-Z0-9\\-]{2,23}" placeholder="${sample ? 'WX-0049' : 'FZ-0001'}" ${row.code ? 'readonly' : ''}></label>
    ${sample ? `<label>收件日期<input name="received" type="date" required value="${h(row.received)}"></label>` : ''}
    <label>送修团队<input name="studio" required maxlength="70" value="${h(row.studio)}"></label>
    <label>鞋型<input name="shoe" required maxlength="70" value="${h(row.shoe)}"></label>
    <label>磨损率 (%)<input name="wear" type="number" min="0" max="100" step="1" required value="${h(row.wear)}"></label>
    <label>开胶长度 (mm)<input name="glue" type="number" min="0" max="350" step="1" required value="${h(row.glue)}"></label>
    <label>鞋底状态<select name="sole">${selectOptions(soles, row.sole)}</select></label>
    ${sample ? `<label>真实处置<select name="label">${selectOptions(routes, row.label)}</select></label>` : ''}
    </div>`;
}
