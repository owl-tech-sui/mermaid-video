// 検証用のMermaid図定義

// 1. 分岐フローチャート（並列処理あり）
export const branchingFlowchart = `flowchart TD
    A[ユーザーリクエスト] --> B{認証済み?}
    B -->|Yes| C[データ取得]
    B -->|No| D[ログイン画面]
    D --> E[認証処理]
    E --> B
    C --> F{キャッシュあり?}
    F -->|Yes| G[キャッシュ返却]
    F -->|No| H[DB問い合わせ]
    H --> I[キャッシュ保存]
    I --> G
    G --> J[レスポンス返却]`;

// 2. シーケンス図
export const sequenceDiagram = `sequenceDiagram
    participant U as ユーザー
    participant F as フロントエンド
    participant A as API
    participant D as データベース

    U->>F: ボタンクリック
    F->>A: POST /api/data
    A->>D: SELECT * FROM users
    D-->>A: ユーザーデータ
    A-->>F: JSON レスポンス
    F-->>U: 画面更新`;

// 3. パイチャート
export const pieChart = `pie title 技術スタック使用率
    "TypeScript" : 40
    "Python" : 25
    "Go" : 15
    "Rust" : 10
    "Other" : 10`;

// 4. クラス図
export const classDiagram = `classDiagram
    class User {
        +String name
        +String email
        +login()
        +logout()
    }
    class Post {
        +String title
        +String content
        +publish()
    }
    class Comment {
        +String text
        +Date createdAt
    }
    User "1" --> "*" Post : creates
    Post "1" --> "*" Comment : has
    User "1" --> "*" Comment : writes`;

// 5. 状態遷移図
export const stateDiagram = `stateDiagram-v2
    [*] --> Idle
    Idle --> Loading : fetch()
    Loading --> Success : データ取得成功
    Loading --> Error : エラー発生
    Success --> Idle : reset()
    Error --> Loading : retry()
    Error --> Idle : reset()`;

// 6. マインドマップ
export const mindmap = `mindmap
    root((AI開発))
        フロントエンド
            React
            Next.js
            TypeScript
        バックエンド
            Python
            FastAPI
            Django
        インフラ
            AWS
            Docker
            Kubernetes
        AI/ML
            PyTorch
            LangChain
            OpenAI`;
