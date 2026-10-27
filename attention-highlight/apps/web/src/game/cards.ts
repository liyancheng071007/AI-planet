/**
 * 科普卡：数据 + 触发矩阵
 *
 * ⚠️ 文案状态：全部为 **AI 起草 / 待 C 定稿**（copyId 已就位，来源见 source 字段）。
 * 按项目红线，科普卡不允许 AI 直接进生产；这里只是把结构与触发跑通。
 * 每张卡硬性约束：≤120 字、1 个比喻 + 1 个术语、1 个"你也试试"动作（方案书 3.4）。
 */
import type { FeedbackCode } from "@attention/engine";

export interface ScienceCard {
  readonly id: string;
  readonly copyId: string;
  readonly title: string;
  readonly body: string;
  readonly action: string;
  /** draft = AI 起草，未定稿 */
  readonly status: "draft" | "final";
  readonly source: "ai" | "human";
}

export const CARDS: Record<string, ScienceCard> = {
  C01: {
    id: "C01",
    copyId: "CARD-C01",
    title: "为什么是 100%",
    body: "AI 看一句话时，会把「眼力」切成很多份分给每个词，加起来正好是 100%。这就像把一块蛋糕分给全班——有人拿到一大块，有人只有蛋糕屑，但蛋糕只有一块。这个分配方式叫**注意力权重**。",
    action: "你也试试：下次先数一数，这句话里有多少个词在「分蛋糕」。",
    status: "draft",
    source: "ai",
  },
  C02: {
    id: "C02",
    copyId: "CARD-C02",
    title: "AI 的「眼力」是什么",
    body: "AI 读句子的时候，不是每个字都同样用力。它会重点看一部分词，别的词只扫一眼。这份用力程度，就是**注意力**。它更像手电筒的光圈，而不是人的「理解」。",
    action: "你也试试：把手挡在屏幕前，只留最亮的那个词，句子还读得懂吗？",
    status: "draft",
    source: "ai",
  },
  C03: {
    id: "C03",
    copyId: "CARD-C03",
    title: "AI 也会认错人",
    body: "「奶娃把书给弟弟，因为他要考试」——这个「他」是谁？AI 得先做一件事，叫**指代消解**：搞清楚这个代词指的是前面哪个人。它会看位置、看搭配，但有时候也会认错。",
    action: "你也试试：把句子里的人换一下，AI 的目光会跟着换吗？",
    status: "draft",
    source: "ai",
  },
  C04: {
    id: "C04",
    copyId: "CARD-C04",
    title: "同一个人，出现两次",
    body: "同一个名字在一句话里出现两次，AI 会把两次的目光**加在一起**算成一个人。所以你标一次就够，标两次不会更得分——这不是 bug，是它在算「这个人总共被看了多少」。",
    action: "你也试试：找到句子里重复出现的那个名字，只标一次。",
    status: "draft",
    source: "ai",
  },
  C05: {
    id: "C05",
    copyId: "CARD-C05",
    title: "虚词也在干活",
    body: "「因为」「所以」「但是」这些词看起来没什么内容，可 AI 常常盯着它们——因为它们是句子的**连接词**，负责告诉你前后两半是什么关系。就像路口的指示牌，本身不是目的地。",
    action: "你也试试：把「因为」换成「所以」，句子的意思还一样吗？",
    status: "draft",
    source: "ai",
  },
  C06: {
    id: "C06",
    copyId: "CARD-C06",
    title: "AI 看到的可能更小",
    body: "你以为的最小单位是「词」，AI 看到的可能是更小的碎片：一个「奶」和一个「娃」。这叫**分词**。所以它会同时看「奶」「娃」两处，而你要点的是整个「奶娃」。",
    action: "你也试试：把「奶娃」拆成两个字读，意思变了吗？",
    status: "draft",
    source: "ai",
  },
  C07: {
    id: "C07",
    copyId: "CARD-C07",
    title: "同一个词，两副面孔",
    body: "同一句话，换一个问法，AI 的目光就会搬家。问「谁要书」时它盯着人名，问「为什么给书」时它盯着「因为」。这叫**上下文相关**——词的重要性不是固定的。",
    action: "你也试试：自己换个问法，猜猜 AI 会改看哪里。",
    status: "draft",
    source: "ai",
  },
  C08: {
    id: "C08",
    copyId: "CARD-C08",
    title: "AI 在找「为什么」",
    body: "看到「因为」「所以」，AI 会顺着它们去找原因和结果。这就像你听到「所以他哭了」，会忍不住往前找「他为什么哭」。AI 也会做这件事，只是它靠的是**权重**，不是真的在推理。",
    action: "你也试试：找出句子里「因为」后面跟着的那件事。",
    status: "draft",
    source: "ai",
  },
  C09: {
    id: "C09",
    copyId: "CARD-C09",
    title: "全都重要＝全都不重要",
    body: "如果每个词都标上，就等于告诉 AI「随便吧」。它的眼力只有 100%，分给 10 个词，每个都只剩一点点。**注意力是一个分布**：有重点，才叫重点。",
    action: "你也试试：只留最有把握的两个词，分数会怎么变？",
    status: "draft",
    source: "ai",
  },
  C10: {
    id: "C10",
    copyId: "CARD-C10",
    title: "AI 会被熟词带跑",
    body: "有些词 AI 见得特别多，一看到就兴奋，哪怕它跟这句话没什么关系。这叫**高频词偏置**。所以第 4 关专门让你抓它走神——你比它更懂这句话。",
    action: "你也试试：找一个「看着眼熟但没用」的词。",
    status: "draft",
    source: "ai",
  },
  C11: {
    id: "C11",
    copyId: "CARD-C11",
    title: "注意力只是线索",
    body: "AI 多看了某个词，**不等于**它就是因为这个词才懂的。注意力是模型内部的一个信号，像体温计上的刻度——能说明一些事，但不是全部。所以我们说它是**线索**，不是「理由」。",
    action: "你也试试：同一个词，你能想出两种读法吗？",
    status: "draft",
    source: "ai",
  },
  C12: {
    id: "C12",
    copyId: "CARD-C12",
    title: "不同的眼睛",
    body: "换一个透镜，同一句话的亮法就变了：指代镜盯着人名，因果镜盯着连接词。这些透镜其实就是模型里不同的**注意力头**。没有哪个是「标准答案」，只是看得角度不同。",
    action: "你也试试：切到因果镜，看看哪几个词亮了。",
    status: "draft",
    source: "ai",
  },
};

export interface TriggerInput {
  readonly primary: FeedbackCode;
  readonly selectedCount: number;
  readonly wordCount: number;
  /** 累计「指代类」错误次数（本局 + 历史） */
  readonly corefMistakes: number;
  /** 连续 ≥80 分的局数 */
  readonly highStreak: number;
  /** 这句话是否带因果标注 */
  readonly hasCausal: boolean;
}

/**
 * 触发矩阵，按方案书 3.4 的顺序判断；命中第一个就返回，避免一次抛三张卡。
 * 返回 null 表示这局不给卡（连续答对时会自动收起，见 C7 红线）。
 */
export function pickCard(input: TriggerInput): ScienceCard | null {
  if (input.corefMistakes >= 2) return CARDS.C03 ?? null;
  if (input.selectedCount === 0) return CARDS.C09 ?? null;
  if (input.selectedCount >= Math.max(4, input.wordCount - 2)) return CARDS.C09 ?? null;
  if (input.highStreak >= 3) return CARDS.C11 ?? null;
  if (input.hasCausal && input.primary === "MISS_SECONDARY") return CARDS.C08 ?? null;
  if (input.primary === "MISS_KEY") return CARDS.C02 ?? null;
  if (input.primary === "OVER_SELECTION") return CARDS.C09 ?? null;
  if (input.primary === "IRRELEVANT") return CARDS.C10 ?? null;
  if (input.primary === "PERFECT") return CARDS.C11 ?? null;
  return CARDS.C01 ?? null;
}
