class AnniversaryCard extends HTMLElement {
  // 비주얼 에디터 설정 (카드 추가 시 기본값)
  static getStubConfig() {
    return {
      type: 'custom:anniversary-card',
      lang: 'ko',
      showdate: 'both',
      numberofdays: 365,
      entities: []
    };
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config) return;

    // TTS 관련 로직을 모두 삭제하고, 엔티티 상태 변화만 감지하도록 단순화
    const entities = this.config.entities || [];
    const firstEntity = entities.length > 0 ? hass.states[entities[0]] : null;
    
    if (firstEntity) {
        if (this._entityState !== firstEntity.state) {
            this._entityState = firstEntity.state;
            this.render();
        }
    } else {
        this.render();
    }
  }

  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error('entities 목록을 설정해야 합니다.');
    }
    this.config = config;
  }

  render() {
    if (!this._hass || !this.config) return;

    const lang = this.config.lang || 'ko';
    const MSG = {
      ko: { title: '기념일', today: '오늘', tomorrow: '내일', none: '예정된 기념일이 없습니다.', days: '일 후', years: '번째', space: '' },
      en: { title: 'Anniversary', today: 'Today', tomorrow: 'Tomorrow', none: 'No anniversaries in the next', days: 'days', years: 'years', space: ' ' }
    }[lang];

    const annivList = [];
    const numberOfDays = this.config.numberofdays || 31;
    const showDate = this.config.showdate || "solar";
    const showKAge = this.config.showkage || false;

    // 순수하게 설정된 엔티티 데이터만 수집
    this.config.entities.forEach(entityId => {
      const stateObj = this._hass.states[entityId];
      if (!stateObj || !stateObj.attributes.upcoming_date) return;

      const attrs = stateObj.attributes;
      const dateObj = new Date(attrs.upcoming_date);
      const lunarDate = attrs.lunar_date ? new Date(attrs.lunar_date) : null;
      const lunarStr = lunarDate ? `음${lunarDate.getMonth() + 1}.${lunarDate.getDate()}` : "";

      annivList.push({
        name: attrs.friendly_name || entityId,
        count: parseInt(stateObj.state) || 0,
        age: attrs.upcoming_count || 0,
        kage: attrs.korean_age || 0,
        month: dateObj.getMonth() + 1,
        day: dateObj.getDate(),
        type: attrs.type || 'event',
        icon: attrs.icon || 'mdi:calendar',
        id: entityId,
        is_lunar: attrs.is_lunar === 'True',
        is_mmdd: attrs.is_mmdd === 'True',
        lunar_date: lunarStr
      });
    });

    // 남은 날짜 순 정렬
    annivList.sort((a, b) => a.count - b.count);

    let htmlToday = "";
    let htmlNext = "";

    annivList.forEach(obj => {
      let nameStr = obj.name;
      // 이벤트나 할일이 아닌 경우 몇 번째인지 표시
      if (!obj.is_mmdd && !['todo', 'event'].includes(obj.type)) {
        nameStr += ` (${obj.age}${MSG.years})`;
      }
      
      // 심볼 처리
      if (obj.type === 'memorial') nameStr += ` <sup>†</sup>`;
      else if (obj.type === 'wedding') nameStr += ` <sup>♥</sup>`;
      else if (showKAge && obj.type === 'birth') nameStr += ` <sup>${obj.kage}</sup>`;

      if (obj.count === 0) {
        htmlToday += `
          <div class="aniv-wrapper aniv-today" data-id="${obj.id}">
            <ha-icon icon="mdi:crown" class="on"></ha-icon>
            <div class="aniv-name">${nameStr}</div>
            <div class="aniv-when">${MSG.today}</div>
          </div>`;
      } else if (obj.count <= numberOfDays) {
        let whenStr = obj.count === 1 ? MSG.tomorrow : `${obj.count}${MSG.days}`;
        let dateStr = `${obj.month}.${obj.day}`;
        
        if (obj.is_lunar) {
          if (showDate === "both") dateStr += `/${obj.lunar_date}`;
          else if (showDate === "lunar") dateStr = obj.lunar_date;
        }
        
        htmlNext += `
          <div class="aniv-wrapper" data-id="${obj.id}">
            <ha-icon icon="${obj.icon}"></ha-icon>
            <div class="aniv-name">${nameStr}</div>
            <div class="aniv-when">${whenStr} (${dateStr})</div>
          </div>`;
      }
    });

    const style = `
      <style>
        ha-card { padding: 16px; }
        .card-header { padding: 0 0 10px 0; font-size: 1.5em; font-weight: 400; }
        .aniv-wrapper { display: flex; align-items: center; padding: 8px 0; cursor: pointer; }
        .aniv-wrapper ha-icon { margin-right: 16px; color: var(--paper-item-icon-color); }
        .aniv-wrapper ha-icon.on { color: var(--paper-item-icon-active-color); }
        .aniv-name { flex: 1; font-size: 1em; }
        .aniv-when { font-size: 0.9em; color: var(--secondary-text-color); }
        .aniv-divider { height: 1px; background: var(--divider-color); margin: 8px 0; }
        .aniv-none { color: var(--secondary-text-color); padding: 8px 0; }
      </style>
    `;

    let content = "";
    if (!htmlToday && !htmlNext) {
      content = `<div class="aniv-none">${MSG.none}</div>`;
    } else {
      content = htmlToday + (htmlToday && htmlNext ? "<div class='aniv-divider'></div>" : "") + htmlNext;
    }

    this.innerHTML = `
      <ha-card>
        <div class="card-header">${this.config.title || MSG.title}</div>
        ${style}
        <div id="container">${content}</div>
      </ha-card>
    `;

    // 클릭 시 상세 정보 팝업
    this.querySelectorAll('.aniv-wrapper').forEach(el => {
      el.addEventListener('click', () => {
        const ev = new CustomEvent('hass-more-info', {
          detail: { entityId: el.dataset.id },
          bubbles: true, composed: true
        });
        this.dispatchEvent(ev);
      });
    });
  }

  getCardSize() {
    return this.config.entities ? this.config.entities.length : 1;
  }
}

customElements.define('anniversary-card', AnniversaryCard);

// 비주얼 에디터 리스트에 등록
window.customCards = window.customCards || [];
window.customCards.push({
  type: "anniversary-card",
  name: "기념일 카드",
  description: "",
  preview: true
});
