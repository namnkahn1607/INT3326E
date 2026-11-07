# Integration requirements checklist: Admin assignment

Purpose: review yêu cầu trước implementation, standard depth, tác giả/PR reviewer.
Created: 2026-10-24. Feature: [spec.md](../spec.md).
Review ownership: review riêng theo AGENTS.md; [x] chỉ là chất lượng yêu cầu,
không chứng minh implementation/cloud hoàn thành. Implement không đổi markers.

## Scope and contract consistency

- [x] CHK001 Phân công TV3 và giới hạn không sửa backend/Driver/AGENTS đã rõ chưa? [Completeness, Spec §Sources/FR010]
- [x] CHK002 Các tên field, role và nguồn actor có thống nhất nguồn chính không? [Consistency, Contracts §Consumer/Spec FR001–005]
- [x] CHK003 Định nghĩa tập dữ liệu/phân trang có tránh total/onlineFlag tự suy không? [Clarity, Spec FR002–003/Plan §Design]

## Assignment and recovery coverage

- [x] CHK004 Các luồng CREATED/ASSIGNED/cùng driver/picked/terminal có yêu cầu rõ chưa? [Coverage, Spec US2/FR004]
- [x] CHK005 Quy tắc chống gửi lặp và xác nhận riêng có đo được không? [Measurability, Spec FR005/SC002]
- [x] CHK006 Timeout/network/5xx/invalid response/conflict có recovery không retry ghi rõ chưa? [Coverage, Spec US3/FR006/Contracts §Errors]
- [x] CHK007 GET recovery thất bại và stale response có yêu cầu khóa ghi/cleanup rõ chưa? [Completeness, Spec FR006/FR008]

## UX and evidence

- [x] CHK008 Label, focus, bàn phím, error announcements và kích thước kiểm tra có quy định chưa? [Clarity, Spec FR007/SC005]
- [x] CHK009 Mock/local/cloud, trạng thái dependency và điều kiện nghiệm thu thật có phân biệt chưa? [Consistency, Spec SC006/Plan §Delivery]
- [x] CHK010 Yêu cầu giữ demo notice ở đúng trang và không fake success có nhất quán không? [Coverage, Spec FR005/FR009]

## Notes

Không có extension hooks. Checklist này tạo unchecked; review và ghi bằng chứng
riêng trước implement theo ủy quyền tự kiểm tra của quy trình project.
