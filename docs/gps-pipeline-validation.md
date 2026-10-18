# Kiểm thử hợp đồng và vận chuyển sự kiện GPS

## Mục tiêu

Xác minh request/event theo [hợp đồng GPS](gps-event-contract.md), payload của emitter và khả năng vận chuyển JSON qua Pub/Sub. Phạm vi này chưa kiểm tra endpoint ingest, xác thực Driver, worker ghi DB, dedupe/ordering trong DB hoặc push subscription Cloud Run.

Phạm vi chính thức tại ô D13 của bảng tiến độ là tiếp tục kiểm thử Pub/Sub và thống nhất schema GPS với người phụ trách pipeline. Các ca NACK/redelivery, kiểm chứng cleanup và báo cáo tự động của smoke runner là kiểm tra kỹ thuật bổ sung trong kế hoạch triển khai, không phải đầu việc bắt buộc riêng được nêu trong bảng tuần 2. Kết quả của chúng vẫn được theo dõi nhưng không thay thế hoặc mở rộng điều kiện phối hợp chốt schema.

Cloud Console và script local sử dụng hai ngữ cảnh xác thực khác nhau. Đăng nhập Console đủ để thử thủ công bằng quyền của tài khoản trên giao diện. Script chạy từ máy cần Application Default Credentials (ADC), hoặc dùng emulator không cần Google credentials. Thiếu ADC trên máy không có nghĩa là project hay tài nguyên cloud của nhóm chưa tồn tại. Xem [hướng dẫn ADC của Google Cloud](https://docs.cloud.google.com/docs/authentication/provide-credentials-adc).

## Kiểm tra tự động trong repository

Chạy từ thư mục gốc, dùng Node.js từ 22.12 trở lên và dependencies theo lockfile:

```powershell
npm test
npm run typecheck
npm run lint:web
npm run build:web
npm run build
npm run lint
```

`npm test` chạy test Worker, contract và smoke runner với SDK mock. Test mock kiểm tra lỗi JSON, dữ liệu bị đổi, thiếu message, lỗi publish, lỗi cleanup và cách cô lập resource. Test contract kiểm tra biên tọa độ, sequence, thời gian, trường bắt buộc, trường thừa và đồng bộ OpenAPI. Các kết quả này không chứng minh đã kết nối Pub/Sub.

## Smoke test qua Pub/Sub emulator

Máy cần Docker hoạt động, hoặc Pub/Sub emulator cài qua Google Cloud CLI. Với cấu hình Docker có sẵn:

```powershell
docker compose -f infra/docker-compose.yml up -d pubsub-emulator
$env:PUBSUB_EMULATOR_HOST = '127.0.0.1:8085'
$env:PUBSUB_PROJECT_ID = 'parcelflow-dev'
$gpsEvidence = 'docs/evidence/gps-pipeline/emulator-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json'
npm run test:gps-pubsub -- --output $gpsEvidence
```

Smoke runner tự tạo topic/subscription riêng, không cần chạy bootstrap và không cần khởi động API/Worker/PostgreSQL. Chỉ chấp nhận địa chỉ loopback ở chế độ emulator. Kiểm tra CLI bằng `npm run test:gps-pubsub -- --help`.

Theo [tài liệu emulator](https://docs.cloud.google.com/pubsub/docs/emulator), emulator chạy cục bộ và có thể khác dịch vụ thật. Kết quả emulator đạt phải được ghi là kiểm thử local, không phải bằng chứng cloud.

## Smoke test trên Google Cloud

Dùng project được cấp quyền, chẳng hạn `int3326e` đã xuất hiện trong hồ sơ tuần 1. Cần Pub/Sub API, ADC của tài khoản được phép tạo/xóa topic/subscription, publish, pull và ACK. Việc đăng nhập/cấu hình xác thực do người có quyền thực hiện theo [hướng dẫn ADC local](https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment).

Sau khi ADC đã sẵn sàng:

```powershell
Remove-Item Env:PUBSUB_EMULATOR_HOST -ErrorAction SilentlyContinue
$gpsEvidence = 'docs/evidence/gps-pipeline/cloud-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json'
npm run test:gps-pubsub -- --cloud --project int3326e --timeout-ms 60000 --output $gpsEvidence
```

`--cloud` và `--project` là bắt buộc để chọn cloud. Script tạo `gps-smoke-<UUID>` trong project đã chọn và chỉ xóa topic/subscription mà chính lượt chạy đã tạo thành công. Không consume `gps-events-sub`, không sửa IAM, không deploy service và không dùng lại subscription đang có consumer khác. Nếu cleanup thất bại, báo cáo ghi `cleanup-failed` cùng tên resource cần người có quyền dọn tiếp.

## Thử thủ công trên Cloud Console

Bằng chứng tuần 1 ghi nhận `projects/int3326e/topics/hello-test` và `projects/int3326e/subscriptions/hello-test-sub`, với nội dung `Hello World`. Giữ nguyên bằng chứng đó. Chưa có kiểm tra lại sự tồn tại của các resource này trong phiên làm việc ngày 16/10/2026.

Để thử payload GPS mà không cần ADC local:

1. Đăng nhập Google Cloud Console, chọn project `int3326e`. Xem lại topic/subscription tuần 1 nếu cần đối chiếu tên resource.
2. Tạo topic thử riêng và pull subscription riêng, ví dụ `gps-contract-review-<mã-lượt-thử>`; ghi tên resource đầy đủ. Tạo subscription trước khi publish. Không dùng subscription của worker nghiệp vụ.
3. Trong topic thử, publish event JSON bảy trường từ mục Event nội bộ của [contract](gps-event-contract.md). Đây là dữ liệu thử do người vận hành mô phỏng phần API bổ sung metadata, không phải event đi qua endpoint thực tế.
4. Publish một event cũ hơn với event ID khác và timestamp sớm hơn 8 giây. Publish lại nguyên event đầu tiên để tạo duplicate payload. Publish event timestamp mới hơn nhưng `seq = 1` để mô phỏng client khởi động lại. Ghi cả bốn message ID được broker trả về.
5. Vào subscription → **Messages** → **Pull**, đối chiếu đủ bảy trường, timestamp và event ID với nội dung đã gửi. Theo [hướng dẫn Pull của Google Cloud](https://docs.cloud.google.com/pubsub/docs/pull-messages), một lần Pull rỗng chưa chứng minh hết message; có thể cần Pull tiếp.
6. Ghi rõ cách ACK của giao diện ở thời điểm thử và lưu bằng chứng riêng cho ACK. Ảnh chỉ thấy payload nhận được chưa chứng minh ACK. Dùng smoke runner khi cần kiểm chứng NACK/redelivery có đối chiếu message ID; không đánh dấu bước đó đạt chỉ từ ảnh Pull.
7. Lưu ảnh/log có project, resource, thời điểm và kết quả. Sau khi đã lưu bằng chứng, dọn topic/subscription riêng của lượt thử theo quy trình vận hành của nhóm.

Không suy ra worker xử lý, phân quyền đúng hoặc DB chống lặp từ phép publish/pull thủ công. Bộ dữ liệu duplicate/out-of-order chỉ giúp kiểm tra vận chuyển payload nguyên vẹn.

## Tiêu chí đạt của smoke runner

| Bước | Điều kiện đạt |
| --- | --- |
| Khởi tạo | Tạo được topic và subscription có cùng UUID; subscription tồn tại trước publish |
| Publish | Bốn message ID khác nhau cho bốn lần publish; hai message có cùng event payload để mô phỏng lặp |
| Pull | Đối chiếu theo message ID, không dựa vào thứ tự nhận; JSON hợp lệ và bằng đúng payload đã gửi |
| Giao lại | NACK message đầu bằng deadline 0, sau đó nhận lại đúng message ID và payload |
| ACK | ACK thành công đủ bốn message ID; có ghi nhận nhận lại sau NACK |
| Kết thúc | Cleanup thành công cả hai resource đã tạo, báo cáo `PASS`, exit code 0 |

`--timeout-ms` giới hạn vòng chờ nhận/giao lại (mặc định 30 giây, từ 1 đến 120 giây). Mỗi RPC có timeout tối đa 5 giây và không tự retry; tổng thời gian chạy còn gồm tạo resource, publish và cleanup. Lỗi broker, payload sai, timeout hoặc cleanup lỗi đều trả exit code khác 0. File `--output` không ghi đè file có sẵn; dùng tên theo từng lượt chạy.

ACK thành công không phải cam kết exactly-once. Duplicate payload có thể mang các message ID khác nhau. Smoke runner dùng resource riêng để kiểm tra transport SDK ↔ broker, chưa xác minh subscription/worker triển khai sẵn của dự án.

## Kết quả kiểm chứng ngày 16/10/2026

| Hạng mục | Kết quả và bằng chứng |
| --- | --- |
| Unit test contract/runner/Worker | `npm test`: 3 file, 59 test đạt (45 contract, 13 runner, 1 health). Runner dùng SDK mock, gồm nhận đảo thứ tự và thiếu redelivery; không gọi dịch vụ Google. [Báo cáo unit test](evidence/gps-pipeline/unit-tests.json). |
| Typecheck | `npm run typecheck`: exit code 0; bao gồm shared GPS types và smoke runner test. |
| Frontend | `npm run lint:web` và `npm run build:web`: exit code 0. Vite build 160 module thành công. |
| Worker | `npm run build`: exit code 0. `npm run lint`: exit code 0, còn cảnh báo scaffold rỗng và cấu hình `strictNullChecks` sẵn có. |
| Lint phần mới | Oxlint trên validator, contract test, smoke runner và runner test: exit code 0. |
| Emitter component | 10 kiểm tra đạt bằng React Test Renderer 19.3.0 và Node mock timers, gồm StrictMode, 8 giây, Stop/Start, sequence và cleanup. [Báo cáo component](evidence/gps-pipeline/emitter-component.json). |
| Emulator | Đã thử nhưng chưa đạt: `ECONNREFUSED 127.0.0.1:8085`, exit code 1, chưa tạo resource. [Báo cáo lượt thử](evidence/gps-pipeline/emulator-attempt.json). |
| Cloud tuần 2 qua Console | Đã có ảnh topic/subscription trong project `int3326e`, thông báo publish thành công và bốn dòng message nhận được. Người vận hành xác nhận đã ACK tất cả; ảnh sau đó hiển thị `Enable ack messages` được chọn và `No message found yet`. Chi tiết và giới hạn bằng chứng ở biên bản dưới đây. |
| Smoke runner trên broker thật | Chưa chạy thành công; NACK/redelivery và cleanup tự động mới được kiểm tra bằng SDK mock. Đây là kiểm chứng bổ sung. |
| Review phối hợp | Contract đã có quyết định kỹ thuật trong phạm vi được người yêu cầu giao; chưa có xác nhận độc lập từ người phụ trách GPS pipeline. |

React Test Renderer và React được cài trong thư mục tạm, không thêm dependency vào repository. Component được transpile từ mã nguồn hiện tại, dùng fake timer để kiểm tra trước mốc 8000 ms, hai mẫu cách nhau 8000 ms, dừng qua hai chu kỳ không tăng mẫu, phát lại tiếp tục `seq = 3`, unmount không phát thêm và remount đặt lại `seq = 1`. Đây là kiểm tra component, chưa phải kiểm tra giao diện trên trình duyệt, chuyển route thực tế hay Network. Harness local nằm ở `.vitest/gps-emitter-review.cjs` (không được Git theo dõi); kết quả JSON được lưu làm bằng chứng. Trong workspace hiện tại có thể chạy lại sau khi đặt `GPS_REVIEW_DIR` trỏ tới thư mục tạm chứa React/React Test Renderer 19.3.0 và gọi `node .vitest/gps-emitter-review.cjs`.

Vite ban đầu bị sandbox chặn tạo tiến trình (`spawn EPERM`). Test và build đã chạy lại thành công với quyền thực thi phù hợp, không sửa cấu hình ứng dụng để né lỗi môi trường.

## Biên bản thử thủ công trên Cloud Console

Ngày thực hiện: 16/10/2026. Project: `int3326e`. Topic: `gps-contract-test-20261016`. Subscription: `gps-contract-test-20261016-sub`. Người vận hành thực hiện trực tiếp trên Console và cung cấp sáu ảnh gốc; ảnh được lưu nguyên trạng trong repository.

| Bằng chứng | Nội dung quan sát được |
| --- | --- |
| [Topic và subscription](evidence/gps-pipeline/cloud-resources.png) | Topic thử có subscription tương ứng trong project `int3326e`. |
| [Thông báo publish](evidence/gps-pipeline/cloud-gps-published.png) | Console hiển thị `Message published`. |
| [Danh sách message](evidence/gps-pipeline/cloud-gps-received-list.png) | Bốn dòng, publish time hiển thị ngày 16/10/2026 lúc 10:36:34 PM, 10:38:04 PM, 10:38:15 PM và 10:38:28 PM theo giao diện. |
| [Payload A/B](evidence/gps-pipeline/cloud-gps-payloads-a-b.png) | Hiển thị bảy tên trường; tọa độ lần lượt `21.0285, 105.8542` và `21.0284, 105.8541`, sequence `2` và `1`. Trạng thái của lượt nhận lúc chụp là `Deadline exceeded`. |
| [Payload C/D](evidence/gps-pipeline/cloud-gps-payloads-c-d.png) | Tọa độ lần lượt `21.0285, 105.8542` và `21.0286, 105.8543`, sequence `2` và `1`; trạng thái lúc chụp là `Deadline exceeded`. |
| [Sau thao tác ACK](evidence/gps-pipeline/cloud-after-ack.png) | `Enable ack messages` được chọn, bảng hiển thị `No message found yet`; người vận hành xác nhận đã bấm ACK tất cả trước ảnh này. |

Kết quả: có bằng chứng cloud cho resource thử, publish và nhận bốn message. ACK được ghi nhận theo xác nhận của người vận hành và ảnh sau thao tác; ảnh Pull rỗng không tự chứng minh đủ bốn message đã ACK thành công. Ảnh payload bị cắt ngang các giá trị `eventId`, `clientTimestamp`, `receivedAt` và không hiển thị đầy đủ message ID, nên chưa đối chiếu được toàn bộ payload, cặp trùng lặp hoặc thứ tự timestamp từ ảnh. Không ghi nhận NACK/redelivery, worker xử lý hay ghi DB từ bộ ảnh này.

## Việc còn mở

1. Để đóng phần phối hợp của tuần 2: người phụ trách GPS pipeline review và xác nhận contract, đặc biệt nguồn định danh, timestamp và quy tắc dedupe. Chưa thay mặt người khác xác nhận hoàn thành bước này.
2. Kiểm chứng bổ sung: khi có môi trường phù hợp, chạy smoke runner trên broker thật để đối chiếu đầy đủ message ID/payload, NACK/redelivery và cleanup. Bộ ảnh Console đã được ghi nhận riêng, không đánh dấu các ca bổ sung đạt từ ảnh.

Chỉ đánh dấu từng phép kiểm tra đạt khi có bằng chứng tương ứng. Lượt thử GPS trên Console đã được thực hiện; không cần chạy lại Hello World tuần 1 để hoàn thiện contract tuần 2.
