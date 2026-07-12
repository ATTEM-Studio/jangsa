(function initPlaceScoreModel(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaPlaceScoreModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPlaceScoreModel() {
  "use strict";

  const PLACE_SCORE_SECTIONS = Object.freeze([
    Object.freeze({
      key: "heroPhoto",
      label: "대표사진",
      maxPoints: 15,
      criterion: "처음 사진만 보고 무엇을 파는지, 가 보고 싶은지 알 수 있어요.",
    }),
    Object.freeze({
      key: "description",
      label: "상세설명",
      maxPoints: 15,
      criterion: "손님에게 어떤 경험을 주는지 쉽게 설명되어 있어요.",
    }),
    Object.freeze({
      key: "directions",
      label: "찾아오는 길",
      maxPoints: 10,
      criterion: "주소와 주차, 오는 길을 미리 알 수 있어요.",
    }),
    Object.freeze({
      key: "keywords",
      label: "대표키워드",
      maxPoints: 10,
      criterion: "지역과 대표 메뉴로 가게를 찾을 수 있어요.",
    }),
    Object.freeze({
      key: "smartCall",
      label: "스마트콜",
      maxPoints: 8,
      criterion: "전화 문의를 바로 시작할 수 있어요.",
    }),
    Object.freeze({
      key: "menuInfo",
      label: "메뉴정보",
      maxPoints: 14,
      criterion: "사진과 가격으로 주문할 메뉴를 고를 수 있어요.",
    }),
    Object.freeze({
      key: "extraInfo",
      label: "부가정보",
      maxPoints: 8,
      criterion: "방문 전에 필요한 편의 정보를 볼 수 있어요.",
    }),
    Object.freeze({
      key: "talkTalk",
      label: "톡톡",
      maxPoints: 6,
      criterion: "자주 묻는 질문과 문의 시작점이 있어요.",
    }),
    Object.freeze({
      key: "reservation",
      label: "예약",
      maxPoints: 7,
      criterion: "시간과 인원을 골라 방문을 정할 수 있어요.",
    }),
    Object.freeze({
      key: "reviewCoupon",
      label: "리뷰 쿠폰 전략",
      maxPoints: 7,
      criterion: "손님이 자연스럽게 후기를 남길 장치가 있어요.",
    }),
  ]);

  const STATE_LABELS = Object.freeze({
    pass: "잘 되어 있어요",
    partial: "조금 아쉬워요",
    fail: "비어 있어요",
    unknown: "아직 확인하지 못했어요",
  });

  function getPlaceScoreSection(key) {
    return PLACE_SCORE_SECTIONS.find((section) => section.key === key) || null;
  }

  function getPlaceScoreStateLabel(state) {
    return STATE_LABELS[state] || STATE_LABELS.unknown;
  }

  return { PLACE_SCORE_SECTIONS, getPlaceScoreSection, getPlaceScoreStateLabel };
});
