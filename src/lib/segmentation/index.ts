/**
 * User Segmentation System
 *
 * Unified segmentation for feature targeting, experiments, and cohort analysis.
 *
 * @example
 * ```ts
 * import { isCompanyInSegment, isFeatureEnabledForCompany } from '@/lib/segmentation'
 *
 * // Check if company is in a segment
 * const isPauscal = await isCompanyInSegment(companyId, 'pausalni_non_vat')
 *
 * // Check if feature is enabled via segment targeting
 * const result = await isFeatureEnabledForCompany('new_dashboard', companyId)
 * if (result.enabled) {
 *   // Show new dashboard
 * }
 * ```
 */

// Types
export type {
  SegmentCondition,
  SegmentRules,
  CompanyAttributes,
  SegmentEvaluationResult,
  SegmentWithStats,
  SegmentableField,
  FieldType,
} from "./types"
export { SEGMENTABLE_FIELDS, SYSTEM_SEGMENTS } from "./types"

// Evaluation
export { evaluateRules, evaluateSegment, evaluateSegments, filterCompaniesBySegment } from "./evaluator"

// Service
export {
  // CRUD
  createSegment,
  updateSegment,
  deleteSegment,
  getSegment,
  getSegmentByName,
  listSegments,
  // Evaluation
  getCompanyAttributes,
  getAllCompanyAttributes,
  evaluateCompanySegments,
  isCompanyInSegment,
  getSegmentMembers,
  // Maintenance
  updateSegmentMemberCount,
  updateAllSegmentCounts,
  trackMembershipChange,
  initializeSystemSegments,
  // Feature targeting
  connectSegmentToFeature,
  disconnectSegmentFromFeature,
  isFeatureEnabledForCompany,
} from "./service"
