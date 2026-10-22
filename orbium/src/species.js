// Creatures from Bert Chan's Lenia animal catalogue (github.com/Chakazul/Lenia,
// Python/animals.json), MIT License, Copyright (c) 2018 Bert Chan.
// Each keeps the rule it was found under. Patterns are stored at the radius R
// given here; zoom them and multiply R by the same factor to run them larger.
// `motion` is checked by test/species.test.js.

export const SPECIES = [
  {
    id: "orbium",
    name: "Orbium unicaudatus",
    code: "O2u",
    rule: { R: 13, T: 10, mu: 0.15, sigma: 0.015, rings: "1" },
    motion: "glides",
    note: "The best-known Lenia glider: a small disc with a tail, travelling in a straight line.",
    cells:
      "7.MD6.qL$6.pKqEqFURpApBRAqQ$5.VqTrSsBrOpXpWpTpWpUpCrQ$4.CQrQsTsWsApITNPpGqGvL$3.IpIpWrOsGsBqXpJ4.LsFrL$A.DpKpSpJpDqOqUqSqE5.ExD$qL.pBpTT2.qCrGrVrWqM5.sTpP$.pGpWpD3.qUsMtItQtJ6.tL$.uFqGH3.pXtOuR2vFsK5.sM$.tUqL4.GuNwAwVxBwNpC4.qXpA$2.uH5.vBxGyEyMyHtW4.qIpL$2.wV5.tIyG3yOxQqW2.FqHpJ$2.tUS4.rM2yOyJyOyHtVpPMpFqNV$2.HsR4.pUxAyOxLxDxEuVrMqBqGqKJ$3.sLpE3.pEuNxHwRwGvUuLsHrCqTpR$3.TrMS2.pFsLvDvPvEuPtNsGrGqIP$4.pRqRpNpFpTrNtGtVtStGsMrNqNpF$5.pMqKqLqRrIsCsLsIrTrFqJpHE$6.RpSqJqPqVqWqRqKpRXE$8.OpBpIpJpFTK!",
  },
  {
    id: "gyrorbium",
    name: "Gyrorbium gyrans",
    code: "OG2g",
    rule: { R: 13, T: 10, mu: 0.156, sigma: 0.0224, rings: "1" },
    motion: "circles",
    note: "A close relative of Orbium that turns as it moves, swimming in a loop.",
    cells:
      "10.EL2QLE$7.TpU2qHqCpXpUpNpFL$4.JrVtTuKuPuKtLrXqTqHqCpPpDG$3.qWtDqRpKqEsMuXvBtGrApXpUpSpIO$2.rQrN4.pAuAvRtTrIpUpIpKpFO$.pSsM6.tJwFuNsPsFrVpPpDL$.uFB6.tJ2yO2yLyOyDsKL$pDuC6.pFxW3yOwIwD2xPqH$rNtV5.EsMxCyIyOwXtJsMtJwFuX$sHuSV3.EpDvOwFxEwQsRqR2qHsFvWE$rQvJsWpPQpKpSqCvEvBuCpD3.BpDtGrQ$pXuKvMuPtLsWsCrIuCtBrS6.qWrQ$EsKvEwXyBwLtVrVsCrDqH6.pXrG$.qHtVxJyOwQrQpNqJpPV6.qJqE$.JsUxMyOrX10.pFqRJ$2.rQxPwIpI9.pKqJT$2.qJxEuPpKB7.qCpP$2.EvOvMpPO5.TrGqH$3.sCyOqEpIOEBOqHqEsRtG$4.xMsMqJqCpXqJqRpIqOuCtBsF$5.xPrAqTqMpSE.rSsMrLqRqHV.TpS$6.vErDE2.VpPB$7.pIrNqHpKQ!",
  },
  {
    id: "scutium",
    name: "Scutium solidus",
    code: "S1s",
    rule: { R: 13, T: 10, mu: 0.29, sigma: 0.045, rings: "1" },
    motion: "glides",
    note: "A glider with a higher mu and a wider growth band; heavier and slower than Orbium.",
    cells:
      "5.pGQ$6.sUsDqRR$4.VpXrJwKvNtXrW$2.ApVrGrWsIwKyOyDwTuNO$2.qArOrIqIpPpTxH2yOyIvKqG$rVpIrNrJpH4.xP3yOvFqWA$sKvNsKqE5.pI4yOuHqPC$sNxBuMpD5.JuN3yOwXsUpN$sGxFyOT5.pCtIyF3yOuKqUH$rPwXyOxT5.qKtSxS3yOvIrQT$pQwK2yOtWXJXqHsGuWxW3yOvPsApC$.vQ3yOuVsLsGsXuMwOyK3yOvHrVpC$.rKyK3yOxEwBwCwXyE3yOxQuMrJU$.WvC5yOyM5yOwFtJqOL$2.rVwO9yOwWuMsApOC$2.pLtBwK6yOyJwQuTsQqLP$3.qHsWvEwUxTyCxRwWvRuGsNqSpA$3.HqBrUtHuGuPuLtVsXrSqIXB$4.DpDqEqW2rIqWqGpJN$6.ENTUPHA!",
  },
  {
    id: "paraptera",
    name: "Paraptera arcus labens",
    code: "P4al",
    rule: { R: 13, T: 10, mu: 0.347, sigma: 0.057, rings: "1" },
    motion: "glides",
    note: "A broad glider, more than twice Orbium's width, that keeps a steady course.",
    cells:
      "10.C2DC$7.KpBpOpXqDqCpUpMpAMD$5.JpOqVrWsQtAtBsVsMrXrGqMpPTE$4.TqTsUuLvLvXwAvSvIuUuFtOsSrTqRpOPA$3.SrPuKwSyH2yOyJxRxEwPwDvNuTtUsSrMqGpCH$3.rOvFyJ6yOyMyGxXxLwRvTuQtLsEqWpRQA$2.qMuU13yOxRwNvHuCsUrOqGpCG$.JtGxX6yO2yDyL5yOyGxAvTuPtKsDqVpON$.qOvQxQyM4yOwRwBwMxLyI5yOyHxBvXuWtWsSrKqBVD$.sMvLwXyI3yOvNtJtLuLvUxGyH4yOyLxHwLvVvHuKtFrWqMpFG$VsOuHwIyF2yOwKrFqJrGsOuCvRxAxTyCyBxWwUwCvXwDwEvSuXtSsHqUpMJ$pLrCtHvUyB2yOrL.BpIqUsLtVvCvRvTvNuNtTtUuOvSwRxBwOvLuCsPrDpRN$.pXsOvKxTyOvJK3.pEqQrWsRsVsPrSqVqTrOtCvFxGyJyExEvVuJsWrKpVP$.pDsAuVxIyDrSpF4.SpQpWpQW2.JpTsAuWxX3yOxNwCuPtDrOqAQ$.MrKuDwNsUrUqMpAD10.NrLvGxV4yOxNwBuRtFrQqBR$2.qRtEqUqMrJrNqWqDpKpBMC7.rQvHxR4yOyIxAvTuPtFrRqAQ$2.pSK.RpWqUrJrNrOrHqSpRN6.sFvPxRyKyN2yOxWwXwHvOuPtGrQqAQ$7.UpPqGqRrCrHrEqKpFH3.pXtXwRxSxUxOxHwUwAvUwBwDvRuRtGrPpXP$10.FUpOqMrCrAqKpVpNqTuTxPyJxPwGvDuLtMtJuDvIwKwRwBuTtFrOpVM$13.QpUqSrFrMsEwO3yOwQtKrUqOqIrBsLuOwRxSxKwHuUtDrLpRH$15.SpOqEuTxUyI2yOuPpW3.pDrHuDxF2yOxUwHuRtArDpHB$17.rCuWvRwXyHyGrT5.qOuFxT3yOxUwDuJsOqPS$17.rTsMtSvLxMvBpW5.qNuRxN4yOxKvQtVrWpSD$16.FpIqLsDuGtVrOqMG4.rAuKxF4yOyMwQuXtBqTQ$18.TqUrFpHqXrDpD4.qWuAwNyD4yOxLvUuBrTpI$19.K2.qArFqJN3.qNtHvJwXyC3yOyDwQuXsQpXD$22.TqLrBqDM2.pWsDtUvHwPxTyM2yOxLvTtKqNH$23.pCqQrDqBI.VqPsCtMuVwKxV2yOyHwPuArAM$24.pJrDrFpH2.VqHrQtFvExI3yOxJuMrEO$24.DqGrPqIF2.KpXrWuLxJ3yOxXuPrDM$25.pIrJrDV3.NrEvAyL3yOyGuLqSH$25.JqQrNqCJ2.FsQxX4yOxVtTqCB$26.pQrHrFpWUJrWyI5yOwTsOpE$26.KqIrMrNrDtN7yOuXqWF$27.pAqPrTuF7yOwQsMpA$28.pCrNxMxSxTxRxPxSyCxGtIpQ$29.uHvD3vJvOwFwOtFpQ$28.qDsBsIsKsLsStMuPrXV$28.WpHpKpLpRqKrQqA$33.L!",
  },
  {
    id: "helicium",
    name: "Helicium solidus",
    code: "H3s",
    rule: { R: 13, T: 10, mu: 0.35, sigma: 0.06, rings: "1" },
    motion: "stays",
    note: "Holds its place: its centre of mass barely moves.",
    cells:
      "9.BG2LID$7.GXpSqIqOqMqFpRpEPE$5.DXqGrOsOtEtHtEsUsKrXrJqPpRTC$4.JpPrKtFuQvMvUvWvX2wAvVvMuRtLrUqCO$3.KqBsEuMwJxNyByI6yOyHwKuErUpRH$2.FpXsKvDxO11yOxIuLrUpRI$2.pKsBvCyE12yOwDtCqQWB9.O$.KrBuHxV4yOyM2yGyM4yOyCuRsNrLpUA9.pEqKpHF$.pKsSwO4yOyFwXwGwJxCyC8yOxOuHrPpWpARNLG2.tArSqLpKXB$.qMuI5yOwEuHtRtWuRwBxO9yOxHuMsTrVrKrBqRqKpWtFuFsSrJqOqM$.rJvO4yOxLtJrQrGrLsGtKvAwWyI7yOyGvSuAsSsBrQ2rOrNsEwNuWtJsHrVpA$BrXwK4yOvKqOpDQVpLqMrVtNvNxFyG2yOwMvGuOtQsLrGqEpLpFpIqArBrWyGwWvHuAtJrC$.sCwRyK3yOtLB5.JpNrBsOtS3.BOSMD5.QqKyCyHxAvPuTsXQ$.rSwJxVyL2yOsP25.JvQyOyGxBwEuMqC$.qXvMwVxT2yOtO26.tP2yOyBxHvQrC$.pTuFvPwNxVyOvWX14.pPpB9.tH3yOyCwHrQ$.HsNuFvBwLxXyBrEpLLB.CJXpRqFqEpOUpJvUwBuPsVrDpQL4.pCuN3yOyNwJrU$2.qNsRtIuQwHxSrVrMqVqKqJqTrPsUuKwGyG5yOyDwSuUtArMqKpTpPqDrSwO4yOvVrN$2.JrGrOsQuEvSrPrDrKrPrVsHtBuFwF9yOxQvVuHtCsIsDsRuPyH4yOuVqU$3.pUpWqQrWtJsNpApNpVqEqLqSrNtAvQ9yOyCwRvMuSuQvJxG4yOxOtMpV$4.GRpQqWsD8.pCrDtRwFyByOyHyG3yOyIxQ2xDxT5yOvLrVU$7.LpMP9.ASqJsPvN6yOyMyN5yOwPtEqEB$19.FpLrNuFxH12yOwUtUrAS$19.MqDsKvAxP10yOyDwGtTrGpE$19.GpPrOtSvRxGyFyOyLyDxTxNxKxDwLvCtDqXpEB$20.GpJqSsDtEtUuHuNuRuVuXuUuKtKrWqGUA$22.FUpNqFqUrJrVsFsHsCrJqJpFH$25.FPpBpL2pQpJUG$28.ACB!",
  },
  {
    id: "kronium",
    name: "Kronium solidus",
    code: "K4s",
    rule: { R: 18, T: 10, mu: 0.24, sigma: 0.029, rings: "1,1/3" },
    motion: "glides",
    note: "A glider on a two-ring kernel, the outer ring a third the height of the inner one.",
    cells:
      "9.GL2OGB$6.BpPrIsM2tDsPrVqTpPO$5.pKsRvRyD4yOxHvRtVrVpUE$4.qEuS10yOwFtLqRJ$3.OuF6yOyL5yOxHuCqTE$3.sFyG3yOxEuCtDtTvJxHyL3yOxHtQpX$2.pPwX3yOsC3.BqHtBvWyG3yOwIsFO$2.uP3yO7.pIsMvRyG2yOyLuFpS$.qMyI2yO9.pPtBwN3yOvWrA$.vGyOwN4.qJsHrQqEB2.qTuNyB2yOxCrSB$pPxMyOpN3.yLwSqMpUrIrA2.TsUxC2yOxRsFG$sHyGvEJ2.xWxC3.GrXL2.rQwL2yOxRsCE$sUxEtVJ.tVuXpN4.sPO2.qWwN2yOxErN$rIvRuFpFrIqRsHpU3.pDtT3.rAxP2yOvWqM$pItTuUwFqMrAsFrQpD2.yBqE3.tG3yOuApF$.tVyGwFvMtBrVrXsHtQyOsK3.ByG2yOxUrQB$.sWtVyLyOvBqTpFvJwDpD4.yB3yOuCpF$2.tBxCyOvJpDqWqM5.4yOwAqE$2.qTuUwVuAsRTB.BLsW4yOwLqM$3.rGsHvWuAsUsCsPuI4yOxHuNpX$4.2sCuIvMwSyLyOyLxWvWtJqOB$6.qJsKuKuStTsHpP$7.B!",
  },
  {
    id: "echinium",
    name: "Echinium solidus",
    code: "3Es",
    rule: { R: 18, T: 10, mu: 0.226, sigma: 0.0272, rings: "3/4,1,1/2" },
    motion: "glides",
    note: "A three-ring kernel creature that creeps forward slowly.",
    cells:
      "18.EIC$17.qRvEwOuQpN$17.vK3yOsN$17.wT3yOtV$10.UrArKpSG2.4yOxSV$9.UxH3yOtDpLuI5yOuFpLDAJqOpW$10.5yOvQ2yO2yN3yOyHwQwWyGyOwMpR$9.qE8yOrPxH9yOsW$9.pG7yOsF.xW9yOtC$9.uF2yOtSuHyM2yO2.xJ4yOyB2yOyFuA$6.rRrIQ3yO2.tPyIyC2.sKxL2yOwBtR2yOrA$5.wJ5yOvM3.rM4.TsTtN.sM2yO$5.yL5yOvN12.3yOpGE$5.wO5yOxL11.uU3yOwKuApP$5.uK2yOyJwWwV11.S6yOxHpE$5.uG2yO14.rBvRxQyK4yOtE$5.vA2yO16.pXuH4yOtT$3.PIvNyNyOC16.rL3yOxU$2.sCwHwUxN2yOqV16.3yOtK$2.6yOqN14.rJ3yOuR$.rJyC3yOyKxE14.pG4yO$2.vO2yOsS16.tP4yOqV$2.tC2yOU17.xN4yOpV$2.pExMyOwCpR16.uK4yOrI$2.EwX3yOtAF14.4yOyL$2.vN5yOqF11.qPtMxC2yOwFqU$.tC6yO11.qQ3yOyLvC$.5yOwPJ11.wE3yOvO$sE4yOuIpA12.pU3yOsQ$sGxM4yOtOtGuArGE3.CuPrUG2.xV2yOxUpI$qHvDvEuCvNyM4yOuGpC2.yM2yOvQrSrF4yOpH$.L3.vE5yOuKG.yJ8yOyN$5.vG6yOrJpIwV3yOyJwVwDuNuL$5.2yOyExU4yOwKxC3yOvJU$5.2yOpXvC2yOxFyE5yOrS$5.xTyOuC2yOuT.qOxO4yOG$5.sRyB2yOxK3.tK4yO$6.qItMtG4.qBwQxOwV$13.pItMrV!",
  },
];
