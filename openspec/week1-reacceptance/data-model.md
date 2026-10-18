# Data Model: Hồ sơ nghiệm thu

Không tạo/sửa bảng hoặc shared type runtime. Các entity dưới đây chỉ tổ chức báo cáo.

| Entity | Fields | Quan hệ/constraint |
| --- | --- | --- |
| Evidence | id, requirementRef, sourceRef, environment, observedAt, sourceSha, version, expected, actual, result, limitation, owner | `result` là PASS/FAIL/NOT_VERIFIED/HISTORICAL; không suy ra PASS từ checkbox cũ. |
| Boundary | week, owner, output, dependency | Tuần 1 tách khỏi tuần 2–5; các dependency chưa implement không làm tuần 1 FAIL. |

Hash asset chứng minh bytes của build, không tự chứng minh cloud source SHA/revision.
Không lưu token, credentials hoặc dữ liệu GPS/địa chỉ cá nhân thật trong evidence.
