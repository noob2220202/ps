// WooriDevKeypad — /dev/keypad 섞인 키패드 (개발용) (자리표시: 화면 작업이 채운다. 스펙 spec/send-b.md · send-b.json)
//   계좌 비밀번호 섞인 숫자 키패드만 단독으로
import { WooriPlaceholder } from './WooriPlaceholder.tsx'

export default function WooriDevKeypad() {
  return <WooriPlaceholder screen="dev-keypad" route="/dev/keypad" title="섞인 키패드 (개발용)" />
}
