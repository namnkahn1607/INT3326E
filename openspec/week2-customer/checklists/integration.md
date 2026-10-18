# Requirements review — Customer integration

Created: 2026-10-18. [Spec](../spec.md). Reviewer-owned; [x] chỉ chất lượng yêu cầu.

- [x] CHK001 Nguồn và ranh giới TV3/TV1/TV6 rõ? [Completeness, Spec §Nguồn]
- [x] CHK002 Tái sử dụng Auth và không nâng quyền rõ? [Consistency, FR-001]
- [x] CHK003 Bắt buộc/tùy chọn/validation/nullable có truy vết? [Clarity, FR-002, data-model]
- [x] CHK004 Retry và deadline đã qua được định nghĩa? [Coverage, FR-003]
- [x] CHK005 Phân biệt lỗi và success/replay rõ? [Coverage, FR-004]
- [x] CHK006 Empty/loading/pagination/scope đủ? [Completeness, FR-005]
- [x] CHK007 URL/refresh chi tiết có tiêu chí nghiệm thu? [Measurability, FR-006]
- [x] CHK008 Cleanup/chuyển tài khoản có yêu cầu? [Coverage, FR-007]
- [x] CHK009 Typography/bàn phím/mobile/reduced-motion đo được? [Clarity, FR-008]
- [x] CHK010 Mock/local/cloud và dependency thiếu tách rõ? [Consistency, FR-009]

Implement chỉ đọc marker; review riêng theo AGENTS trước implement.

Review riêng 2026-10-18: 10/10. CHK001–002: Nguồn/FR1; CHK003: data-model;
CHK004–005: FR3–4/contracts; CHK006–008: US3/FR5–7; CHK009: FR8 có viewport/kích thước;
CHK010: FR9/Assumptions/quickstart tách rõ mock và cloud. Không miễn gate cloud.
