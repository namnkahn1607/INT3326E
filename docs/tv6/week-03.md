# Tuần 3: tài liệu

Mục lục: [TV6 theo tuần](tv6-weekly.md)

Trạng thái sheet: Chưa cập nhật. Không tự xác nhận đã được duyệt.

## Việc của TV6 theo sheet

Tổng hợp constitution, hướng dẫn agent, traceability và phân công tuần 4–13.

## Phân rã chi tiết

| Mã | Bước | Đầu vào / phụ thuộc | Đầu ra | Tiêu chí | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| W3-TV6-01 | Tổng hợp constitution | Tài liệu tuần 2 | `constitution.md` | Phần VIII | Ở checkout `parcelflow-docs-revision`, chưa commit |
| W3-TV6-02 | Hướng dẫn agent | Constitution | `AGENTS.md`, `CLAUDE.md` | Phần VIII | `AGENTS.md` do người khác commit; `CLAUDE.md` chưa vào develop |
| W3-TV6-03 | Traceability FR/AC/NFR/TC | Đặc tả v1.4 | Bảng truy vết | FR01–FR10, AC01–AC10 | Một phần trong `qa-test-plan.md` |
| W3-TV6-04 | Phân công tuần 4–13 | Sheet phân công | [`week-task-breakdown.md`](week-task-breakdown.md) | Phần VII | Đã có (soạn 05/11) |

## Đã làm được

- Phân rã công việc tuần 4–13 ở [week-task-breakdown.md](week-task-breakdown.md).
- Bảng checkpoint nghiệp vụ nối mã TC của đặc tả với chủ component trong `qa-test-plan.md`.

## Còn thiếu và rủi ro

- Constitution chưa nằm trong `develop`; file ở checkout `parcelflow-docs-revision` có từ trước bản v1.4 nên cần đối chiếu trước khi dùng.
- `AGENTS.md` trong develop là commit của Tuấn (10/10) và Khánh (04/10), không phải của TV6.
