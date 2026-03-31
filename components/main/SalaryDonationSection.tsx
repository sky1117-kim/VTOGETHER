export function SalaryDonationSection() {
  return (
    <section id="salary-donation" className="mb-16">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="section-title flex items-center gap-3 text-gray-900">
            <span className="h-8 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
            개인 기부 (급여 공제)
          </h2>
          <p className="mt-1 text-gray-500">
            매월 급여 또는 신청 익월 급여에서 공제되는 정기/일시 후원 신청입니다.
          </p>
        </div>
        <div className="text-right">
          <span className="inline-block animate-pulse rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
            신청 마감: 1월 12일까지
          </span>
        </div>
      </div>
      <div className="card-hover glass flex flex-col gap-6 overflow-hidden rounded-3xl p-8 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="flex-1 text-sm text-gray-600">
          <h4 className="mb-2 text-lg font-bold text-gray-900">
            따뜻한 나눔에 동참하세요
          </h4>
          <ul className="list-inside list-disc space-y-1">
            <li>
              <span className="font-bold text-indigo-700">일시 후원:</span> 신청
              익월 급여에서 1회 공제
            </li>
            <li>
              <span className="font-bold text-indigo-700">정기 후원:</span> 매달
              급여에서 정기 공제
            </li>
          </ul>
          <p className="mt-2 text-xs font-medium text-red-500">
            * 기존 정기후원자 분들도 연장을 희망하실 경우 설문을 새로
            작성해주세요.
          </p>
        </div>
        <a
          href="https://forms.gle/voHLTomhbQ2Q5o4A8"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-indigo-600 px-8 py-4 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl md:w-auto"
        >
          <span>신청서 작성하기 (Google Form)</span>
          <span>→</span>
        </a>
      </div>
    </section>
  )
}
