# ParcelFlow MVP - Agent contract

## How to work here

- Smallest diff that solves the problem. Do not rename, reformat, or refactor code you were
  not asked to touch.
- Do not invent APIs, flags, or CI job names. Grep first. If unsure, say so.

## Conventions (when writing code)

- Comments explain why, or state a non-obvious invariant or memory ordering justification but not
  restate what the code does. No banner or section comments. Do not rewrite an existing comment unless
  the code behavior it describe changes.

## Quy trình phát triển bằng Spec Kit

Áp dụng khi người dùng giao một tính năng hoặc nhiệm vụ phát triển bằng Spec Kit.
Yêu cầu chỉ sửa hướng dẫn/tài liệu không tự kích hoạt chuỗi triển khai tính năng.

1. Đọc `AGENTS.md`, `.specify/memory/constitution.md`, tài liệu yêu cầu đã thống nhất
   và code liên quan. Kiểm tra `git status`, `git diff` và `git diff --cached`
   để bảo toàn cả thay đổi đã stage, chưa stage và file chưa được Git theo dõi.
2. Xác định phạm vi, nguồn yêu cầu chính thức, hiện trạng và phụ thuộc.
   Báo cáo do AI tạo là tài liệu hỗ trợ, không tự trở thành yêu cầu chính thức;
   phải đối chiếu với chỉ dẫn người dùng và quyết định đã được chấp thuận.
3. Tìm bộ spec tương ứng trước khi tạo mới; cập nhật bộ đã có và bảo toàn nội dung
   còn hiệu lực, không tạo trùng hoặc sao chép template đè lên spec/plan/tasks hiện có.
   Chỉ tạo hoặc sửa constitution khi nhiệm vụ yêu cầu thay đổi nguyên tắc.
4. Đọc hướng dẫn các skill đã cài và thực hiện theo thứ tự:

   `$speckit-specify` → `$speckit-clarify` → `$speckit-plan` → `$speckit-checklist`
   → `$speckit-tasks` → `$speckit-analyze` → `$speckit-implement` → `$speckit-converge`.

   Khi tiếp tục công việc đã có, dùng đúng bộ spec và kiểm tra artifact của các bước
   trước; không chạy lại script tạo mới chỉ để đủ thứ tự hoặc làm mất tiến độ cũ.
5. Sau mỗi bước, tự đọc, kiểm tra chất lượng và tính nhất quán của kết quả trước
   khi tiếp tục. Sửa vấn đề analyze phát hiện trong phạm vi yêu cầu đã chốt,
   cập nhật tài liệu liên quan và phân tích lại khi cần. Không triển khai khi còn
   mâu thuẫn nghiêm trọng chưa được giải quyết.
6. Triển khai theo tasks và phụ thuộc; chạy build/test, kiểm chứng tiêu chí nghiệm thu
   phù hợp với phần thay đổi. Khi converge phát hiện thiếu sót trong phạm vi,
   bổ sung task có truy vết, quay lại implement rồi converge cho đến khi đạt
   hoặc có blocker cần quyết định/thay đổi trạng thái bên ngoài. Không đánh dấu
   hoàn thành khi vẫn còn việc bắt buộc hoặc bước kiểm chứng chưa đạt.

### Tự chủ và giới hạn hành động

- Không dừng chỉ để hỏi có muốn chuyển sang bước tiếp theo. Báo tiến độ ngắn gọn
  và tiếp tục các bước đã được giao.
- Tự quyết định chi tiết kỹ thuật thông thường dựa trên tài liệu, constitution
  và kiến trúc hiện có; ghi nhận giả định khi cần để người dùng kiểm tra.
- Chỉ hỏi khi thiếu quyết định ảnh hưởng yêu cầu, API, dữ liệu hoặc phạm vi mà
  nguồn hiện có không giải quyết được. Nêu điểm chưa rõ và tác động cụ thể;
  trong lúc chờ, tiếp tục phần độc lập với câu trả lời.
- Không mở rộng chức năng hoặc biến suy đoán, proposal, báo cáo AI thành yêu cầu đã chốt.
  Nếu tài liệu mâu thuẫn, báo rõ vị trí và nội dung; không âm thầm chọn một hướng
  làm thay đổi yêu cầu hoặc sửa constitution để hợp thức hóa implementation.
- Bảo toàn công việc hiện có; không reset hoặc xóa thay đổi không liên quan.
- Chỉ đánh dấu task hoàn thành khi có bằng chứng tương ứng. Phân biệt kiểm tra mock,
  kiểm tra local và kiểm tra môi trường thật; nêu bước chưa kiểm chứng và nguyên nhân.
- Không tự commit, push hoặc triển khai lên môi trường ngoài nếu người dùng chưa
  yêu cầu hành động đó cho nhiệm vụ hiện tại. Yêu cầu trong nhiệm vụ trước không
  tự cấp quyền cho nhiệm vụ mới; quy tắc này cũng áp dụng cho extension hooks.

### Áp dụng cùng các giới hạn của skill

- Quy trình người dùng quy định ở đây ưu tiên hơn mặc định skill khi mâu thuẫn;
  phải nêu rõ khác biệt và cách xử lý, giữ giới hạn phạm vi và yêu cầu kiểm chứng.
- Với specify, chọn bộ spec đã có khi tiếp tục cùng tính năng thay vì mặc định
  tạo feature directory mới. Không ghi đè artifact đã được người dùng chỉnh sửa.
- Analyze vẫn chỉ đọc và xuất findings. Việc sửa được thực hiện sau bước analyze,
  bằng cập nhật artifact/skill phù hợp; quy trình này đã ủy quyền sửa trong phạm vi
  đã chốt, không cần hỏi lại chỉ để sửa hoặc chuyển bước.
- Checklist đánh giá chất lượng yêu cầu, không chứng minh implementation hoàn tất.
  Bước checklist chỉ tạo/thêm mục chưa đánh dấu; theo ủy quyền tự kiểm tra của
  quy trình này, agent đánh giá checklist trong một bước review riêng trước implement.
  Chỉ đánh dấu đạt khi yêu cầu có bằng chứng rõ ràng; không đánh dấu hàng loạt
  để vượt gate, không sửa marker trong bước implement. Mục chưa đạt phải được sửa
  trong phạm vi đã chốt hoặc làm rõ theo quy tắc hỏi ở trên, không tự bỏ qua.
- Converge chỉ đánh giá hiện trạng và thêm task còn thiếu ở cuối `tasks.md`,
  giữ ID/task cũ; không trực tiếp sửa code/spec/plan trong bước converge.
  Thực hiện task bổ sung bằng lượt implement tiếp theo. Phần ngoài phạm vi chỉ
  được báo để xem xét, không tự thêm thành chức năng hoặc xóa code của người khác.

### Báo cáo cuối

Nêu phần đã làm và file liên quan, kết quả kiểm chứng kèm bằng chứng,
việc còn mở/blocker và nguyên nhân, cùng cách chạy lại các kiểm tra phù hợp.
Nếu chỉ sửa tài liệu, kiểm tra diff/nội dung là đủ; không tuyên bố đã chạy build/test
khi chưa chạy và không bắt đầu tính năng mới để kiểm tra quy trình này.
