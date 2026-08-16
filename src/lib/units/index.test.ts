import { describe, expect, it } from 'vitest'
import { findStrayConversionFiles } from './checkNoStrayConversion'
import {
  fromCanonicalMl,
  makeFeedingAmount,
  formatForDisplay,
  formatTotal,
  snapToGrid,
  stepFor,
  toCanonicalMl,
  type Unit,
} from './index.ts'

/** Every valid stepper value in [start, end] for a unit's grid. */
function gridValues(start: number, end: number, unit: Unit): number[] {
  const step = stepFor(unit)
  const values: number[] = []
  for (let v = start; v <= end + 1e-9; v = Number((v + step).toFixed(2))) {
    values.push(v)
  }
  return values
}

describe('round-trip: enter -> store -> display in same unit is byte-identical', () => {
  it('ml values in steps of 5 (0..1000)', () => {
    for (const value of gridValues(0, 1000, 'ml')) {
      const record = makeFeedingAmount(value, 'ml')
      expect(formatForDisplay(record, 'ml')).toBe(String(value))
    }
  })

  it('oz values in steps of 0.5 (0..40)', () => {
    for (const value of gridValues(0, 40, 'oz')) {
      const record = makeFeedingAmount(value, 'oz')
      const expected = Number.isInteger(value)
        ? String(value)
        : String(Number(value.toFixed(2)))
      expect(formatForDisplay(record, 'oz')).toBe(expected)
    }
  })
})

describe('aggregation: total converts summed ml once, not per-record', () => {
  it('formatTotal converts the summed ml once (independently hand-computed)', () => {
    // Hand-computed against the ml<->oz factor (defined only in index.ts):
    //   4 oz  -> round(118.294..) = 118 ml
    //   3 oz  -> round( 88.721..) =  89 ml
    //   100 ml (entered in ml)    = 100 ml
    // sum = 307 ml. As oz that is 10.3809.. oz, snapped to the nearest 0.5
    // grid -> 10.5. Expectation is a literal, NOT re-derived via the
    // module's constants/functions.
    const records = [
      makeFeedingAmount(4, 'oz'),
      makeFeedingAmount(3, 'oz'),
      makeFeedingAmount(100, 'ml'),
    ]
    const totalMl = records.reduce((sum, r) => sum + r.amount_ml, 0)
    expect(totalMl).toBe(307)
    expect(formatTotal(totalMl, 'oz')).toBe('10.5')
  })

  it('diverges from summing per-record converted+rounded values', () => {
    // Three 1-oz entries: each stored as the rounded ml canonical (30 ml).
    const records = [
      makeFeedingAmount(1, 'oz'),
      makeFeedingAmount(1, 'oz'),
      makeFeedingAmount(1, 'oz'),
    ]
    const totalMl = records.reduce((sum, r) => sum + r.amount_ml, 0) // 90 ml

    // Correct: convert the summed ml once, snap once -> 3 oz.
    const correct = formatTotal(totalMl, 'oz')

    // Wrong: snap each record to the oz grid, then sum -> 1 + 1 + 1 -> but each
    // 30 ml converts to 1.014.. oz which snaps to 1.0, summing to 3.0. To show a
    // genuine divergence use values whose per-record snap rounds differently.
    const skew = [
      makeFeedingAmount(40, 'ml'),
      makeFeedingAmount(40, 'ml'),
      makeFeedingAmount(40, 'ml'),
    ]
    const skewTotalMl = skew.reduce((sum, r) => sum + r.amount_ml, 0) // 120 ml
    const correctSkew = formatTotal(skewTotalMl, 'oz') // 120ml -> 4.057.. -> snap 4
    const perRecordSum = skew
      .map((r) => snapToGrid(fromCanonicalMl(r.amount_ml, 'oz'), 'oz')) // 40ml->1.35->1.5
      .reduce((sum, v) => sum + v, 0) // 4.5

    expect(correct).toBe('3')
    expect(correctSkew).toBe('4')
    expect(String(perRecordSum)).not.toBe(correctSkew)
  })
})

describe('cross-unit snap (spec examples)', () => {
  it('entered 4 oz -> amount_ml 118 -> ml-view "120"', () => {
    const record = makeFeedingAmount(4, 'oz')
    expect(record.amount_ml).toBe(118)
    expect(formatForDisplay(record, 'ml')).toBe('120')
  })

  it('entered 100 ml -> oz-view "3.5"', () => {
    const record = makeFeedingAmount(100, 'ml')
    expect(formatForDisplay(record, 'oz')).toBe('3.5')
  })
})

describe('conversion primitives', () => {
  it('toCanonicalMl rounds half-up', () => {
    expect(toCanonicalMl(0.5, 'ml')).toBe(1)
    expect(toCanonicalMl(1, 'oz')).toBe(30)
  })

  it('fromCanonicalMl is full precision (no rounding)', () => {
    expect(fromCanonicalMl(118, 'ml')).toBe(118)
    // Not a round number in oz -> proves no snapping/rounding on the raw convert.
    expect(Number.isInteger(fromCanonicalMl(118, 'oz'))).toBe(false)
    expect(fromCanonicalMl(118, 'oz')).toBeGreaterThan(3.9)
    expect(fromCanonicalMl(118, 'oz')).toBeLessThan(4)
  })
})

describe('grep-guard: conversion constant is centralized (spec Decision 5)', () => {
  it('constant appears in no source file except src/lib/units/index.ts', async () => {
    expect(await findStrayConversionFiles()).toEqual([])
  })
})
