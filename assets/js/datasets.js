/* =============================================================
   datasets.js · 内置数据集（中英双语，列 key 稳定不随语言变化）
   - cols[].key  稳定标识（步骤参数、动画剧本都用它寻址）
   - cols[].zh/en 当前语言下显示的表头
   - rows / rowsEn 两套数据（文本列双语，数值列一致）
   ============================================================= */
(function (global) {
  'use strict';

  const DATASETS = [
    /* ------------------------------ 学生成绩 ------------------------------ */
    {
      id: 'students',
      icon: '🎓',
      cols: [
        { key: 'id', zh: '学号', en: 'ID' },
        { key: 'name', zh: '姓名', en: 'Name' },
        { key: 'cls', zh: '班级', en: 'Class' },
        { key: 'gender', zh: '性别', en: 'Gender' },
        { key: 'chinese', zh: '语文', en: 'Chinese' },
        { key: 'math', zh: '数学', en: 'Math' },
        { key: 'english', zh: '英语', en: 'English' },
        { key: 'attend', zh: '出勤率', en: 'Attendance' },
      ],
      rows: [
        [1, '张若曦', '一班', '女', 88, 92, 90, 0.98],
        [2, '李承宇', '一班', '男', 76, 81, 79, 0.92],
        [3, '王思远', '一班', '男', 92, 88, 85, 0.96],
        [4, '陈牧野', '二班', '女', 58, 63, 60, 0.79],
        [5, '周清和', '二班', '女', 95, 90, 93, 1],
        [6, '孙嘉言', '二班', '男', 82, null, 77, 0.88],
        [7, '吴澜', '二班', '女', 71, 74, 70, 0.85],
        [8, '郑亦航', '三班', '男', 66, null, 72, 0.9],
        [9, '冯书瑶', '三班', '女', 89, 91, 87, 0.97],
        [10, '韩星洲', '三班', '男', 100, 96, 94, 0.99],
        [11, '杨柳依', '三班', '女', 73, 70, 68, 0.83],
        [12, '王思远', '一班', '男', 92, 88, 85, 0.96],
        [13, '何知微', '一班', '女', 84, 86, 82, 0.94],
        [14, '曹砚青', '二班', '男', 61, 66, 64, 0.81],
        [15, '潘越泽', '二班', '男', 78, 80, 75, 0.9],
        [16, '苏晚晴', '三班', '女', 87, 84, 88, 0.95],
        [17, '邓子谦', '三班', '男', 69, 72, 71, 0.87],
        [18, '薛映竹', '一班', '女', 93, 89, 91, 0.98],
        [19, '罗嘉树', '一班', '男', 64, 68, 66, 0.84],
        [20, '袁清让', '二班', '女', 81, 79, 83, 0.91],
        [21, '傅明彻', '二班', '男', 57, 62, 59, 0.76],
        [22, '蒋南枝', '三班', '女', 90, 87, 89, 0.96],
        [23, '沈砚舟', '三班', '男', 75, 78, 76, 0.89],
        [24, '温以宁', '一班', '女', 86, 83, 85, 0.93],
      ],
      rowsEn: [
        [1, 'Zhang Ruoxi', 'Class 1', 'F', 88, 92, 90, 0.98],
        [2, 'Li Chengyu', 'Class 1', 'M', 76, 81, 79, 0.92],
        [3, 'Wang Siyuan', 'Class 1', 'M', 92, 88, 85, 0.96],
        [4, 'Chen Muye', 'Class 2', 'F', 58, 63, 60, 0.79],
        [5, 'Zhou Qinghe', 'Class 2', 'F', 95, 90, 93, 1],
        [6, 'Sun Jiayan', 'Class 2', 'M', 82, null, 77, 0.88],
        [7, 'Wu Lan', 'Class 2', 'F', 71, 74, 70, 0.85],
        [8, 'Zheng Yihang', 'Class 3', 'M', 66, null, 72, 0.9],
        [9, 'Feng Shuyao', 'Class 3', 'F', 89, 91, 87, 0.97],
        [10, 'Han Xingzhou', 'Class 3', 'M', 100, 96, 94, 0.99],
        [11, 'Yang Liuyi', 'Class 3', 'F', 73, 70, 68, 0.83],
        [12, 'Wang Siyuan', 'Class 1', 'M', 92, 88, 85, 0.96],
        [13, 'He Zhiwei', 'Class 1', 'F', 84, 86, 82, 0.94],
        [14, 'Cao Yanqing', 'Class 2', 'M', 61, 66, 64, 0.81],
        [15, 'Pan Yueze', 'Class 2', 'M', 78, 80, 75, 0.9],
        [16, 'Su Wanqing', 'Class 3', 'F', 87, 84, 88, 0.95],
        [17, 'Deng Ziqian', 'Class 3', 'M', 69, 72, 71, 0.87],
        [18, 'Xue Yingzhu', 'Class 1', 'F', 93, 89, 91, 0.98],
        [19, 'Luo Jiashu', 'Class 1', 'M', 64, 68, 66, 0.84],
        [20, 'Yuan Qingrang', 'Class 2', 'F', 81, 79, 83, 0.91],
        [21, 'Fu Mingche', 'Class 2', 'M', 57, 62, 59, 0.76],
        [22, 'Jiang Nanzhi', 'Class 3', 'F', 90, 87, 89, 0.96],
        [23, 'Shen Yanzhou', 'Class 3', 'M', 75, 78, 76, 0.89],
        [24, 'Wen Yining', 'Class 1', 'F', 86, 83, 85, 0.93],
      ],
      lookup: {
        cols: [{ key: 'cls', zh: '班级', en: 'Class' }, { key: 'teacher', zh: '班主任', en: 'Advisor' }, { key: 'size', zh: '班级人数', en: 'Class size' }],
        rows: [['一班', '王老师', 42], ['二班', '李老师', 40], ['三班', '陈老师', 45]],
        rowsEn: [['Class 1', 'Mr. Wang', 42], ['Class 2', 'Ms. Li', 40], ['Class 3', 'Mr. Chen', 45]],
      },
      extra: {
        rows: [
          [25, '顾长风', '一班', '男', 68, 71, 69, 0.86],
          [26, '白露微', '二班', '女', 79, 76, 78, 0.9],
          [27, '秦望舒', '二班', '女', 85, 88, 86, 0.94],
          [28, '宋怀瑾', '三班', '男', 67, 70, 72, 0.85],
        ],
        rowsEn: [
          [25, 'Gu Changfeng', 'Class 1', 'M', 68, 71, 69, 0.86],
          [26, 'Bai Luwei', 'Class 2', 'F', 79, 76, 78, 0.9],
          [27, 'Qin Wangshu', 'Class 2', 'F', 85, 88, 86, 0.94],
          [28, 'Song Huaijin', 'Class 3', 'M', 67, 70, 72, 0.85],
        ],
      },
      demo: [
        { op: 'missing', params: { strategy: 'fillna', how: 'mean', cols: ['math'] } },
        { op: 'dedupe', params: { cols: ['name'] } },
        { op: 'assign', params: { name: '@total', mode: 'sum', cols: ['chinese', 'math', 'english'] } },
        { op: 'outlier', params: { mode: 'extreme', col: 'total', n: 1 } },
        { op: 'groupby', params: { by: 'cls', col: 'total', how: 'mean' } },
        { op: 'sort', params: { col: 'total_mean', asc: 'desc' } },
      ],
    },

    /* ------------------------------ 门店销售 ------------------------------ */
    {
      id: 'sales',
      icon: '🏪',
      cols: [
        { key: 'date', zh: '日期', en: 'Date' },
        { key: 'region', zh: '区域', en: 'Region' },
        { key: 'store', zh: '门店', en: 'Store' },
        { key: 'category', zh: '品类', en: 'Category' },
        { key: 'qty', zh: '销量', en: 'Quantity' },
        { key: 'amount', zh: '销售额', en: 'Amount' },
        { key: 'promo', zh: '是否促销', en: 'Promo' },
      ],
      rows: [
        ['2026-03-01', '华东', '南京西路', '数码', 12, 4520, '是'],
        ['2026-03-01', '华东', '陆家嘴', '家居', 8, 3110, '否'],
        ['2026-03-01', '华北', '国贸', '数码', 15, 5630, '是'],
        ['2026-03-01', '华南', '天河城', '服饰', 21, 3980, '否'],
        ['2026-03-02', '华东', '南京西路', '家居', 9, 3420, '否'],
        ['2026-03-02', '华北', '西单', '数码', 7, 2680, '否'],
        ['2026-03-02', '华南', '万象城', '服饰', 18, 3560, '是'],
        ['2026-03-02', '华东', '陆家嘴', '数码', 13, 4890, '否'],
        ['2026-03-03', '华北', '国贸', '家居', 6, 2310, '否'],
        ['2026-03-03', '华南', '天河城', '数码', 96, 35600, '否'],
        ['2026-03-03', '华东', '静安寺', '服饰', 14, 2760, '是'],
        ['2026-03-03', '华北', '西单', '服饰', 11, 2210, '否'],
        ['2026-03-04', '华东', '静安寺', '数码', 10, 3780, '否'],
        ['2026-03-04', '华南', '万象城', '家居', 5, 1980, '否'],
        ['2026-03-04', '华北', '国贸', '数码', null, null, '是'],
        ['2026-03-04', '华东', '南京西路', '服饰', 16, 3050, '否'],
        ['2026-03-05', '华南', '天河城', '家居', 7, 2540, '否'],
        ['2026-03-05', '华北', '西单', '家居', 4, 1620, '否'],
        ['2026-03-05', '华东', '陆家嘴', '服饰', 19, 3620, '是'],
        ['2026-03-05', '华南', '万象城', '数码', 12, 4410, '否'],
        ['2026-03-06', '华东', '静安寺', '家居', 6, 2260, '否'],
        ['2026-03-06', '华北', '国贸', '服饰', 13, 2580, '否'],
        ['2026-03-06', '华南', '天河城', '数码', 11, 4020, '是'],
        ['2026-03-06', '华东', '南京西路', '数码', 14, 5180, '是'],
      ],
      rowsEn: [
        ['2026-03-01', 'East', 'Nanjing W.', 'Digital', 12, 4520, 'Yes'],
        ['2026-03-01', 'East', 'Lujiazui', 'Home', 8, 3110, 'No'],
        ['2026-03-01', 'North', 'Guomao', 'Digital', 15, 5630, 'Yes'],
        ['2026-03-01', 'South', 'Teemall', 'Apparel', 21, 3980, 'No'],
        ['2026-03-02', 'East', 'Nanjing W.', 'Home', 9, 3420, 'No'],
        ['2026-03-02', 'North', 'Xidan', 'Digital', 7, 2680, 'No'],
        ['2026-03-02', 'South', 'MixC', 'Apparel', 18, 3560, 'Yes'],
        ['2026-03-02', 'East', 'Lujiazui', 'Digital', 13, 4890, 'No'],
        ['2026-03-03', 'North', 'Guomao', 'Home', 6, 2310, 'No'],
        ['2026-03-03', 'South', 'Teemall', 'Digital', 96, 35600, 'No'],
        ['2026-03-03', 'East', 'Jing\'an', 'Apparel', 14, 2760, 'Yes'],
        ['2026-03-03', 'North', 'Xidan', 'Apparel', 11, 2210, 'No'],
        ['2026-03-04', 'East', 'Jing\'an', 'Digital', 10, 3780, 'No'],
        ['2026-03-04', 'South', 'MixC', 'Home', 5, 1980, 'No'],
        ['2026-03-04', 'North', 'Guomao', 'Digital', null, null, 'Yes'],
        ['2026-03-04', 'East', 'Nanjing W.', 'Apparel', 16, 3050, 'No'],
        ['2026-03-05', 'South', 'Teemall', 'Home', 7, 2540, 'No'],
        ['2026-03-05', 'North', 'Xidan', 'Home', 4, 1620, 'No'],
        ['2026-03-05', 'East', 'Lujiazui', 'Apparel', 19, 3620, 'Yes'],
        ['2026-03-05', 'South', 'MixC', 'Digital', 12, 4410, 'No'],
        ['2026-03-06', 'East', 'Jing\'an', 'Home', 6, 2260, 'No'],
        ['2026-03-06', 'North', 'Guomao', 'Apparel', 13, 2580, 'No'],
        ['2026-03-06', 'South', 'Teemall', 'Digital', 11, 4020, 'Yes'],
        ['2026-03-06', 'East', 'Nanjing W.', 'Digital', 14, 5180, 'Yes'],
      ],
      lookup: {
        cols: [{ key: 'store', zh: '门店', en: 'Store' }, { key: 'manager', zh: '店长', en: 'Manager' }, { key: 'area', zh: '营业面积', en: 'Area' }],
        rows: [['南京西路', '赵敏', 320], ['陆家嘴', '钱伟', 280], ['静安寺', '孙丽', 260], ['国贸', '周涛', 410], ['西单', '吴强', 300], ['天河城', '郑爽', 350], ['万象城', '王芳', 380]],
        rowsEn: [['Nanjing W.', 'Zhao Min', 320], ['Lujiazui', 'Qian Wei', 280], ['Jing\'an', 'Sun Li', 260], ['Guomao', 'Zhou Tao', 410], ['Xidan', 'Wu Qiang', 300], ['Teemall', 'Zheng Shuang', 350], ['MixC', 'Wang Fang', 380]],
      },
      extra: {
        rows: [
          ['2026-03-07', '华北', '西单', '数码', 9, 3350, '否'],
          ['2026-03-07', '华南', '万象城', '服饰', 17, 3290, '是'],
          ['2026-03-07', '华东', '静安寺', '数码', 12, 4460, '否'],
        ],
        rowsEn: [
          ['2026-03-07', 'North', 'Xidan', 'Digital', 9, 3350, 'No'],
          ['2026-03-07', 'South', 'MixC', 'Apparel', 17, 3290, 'Yes'],
          ['2026-03-07', 'East', 'Jing\'an', 'Digital', 12, 4460, 'No'],
        ],
      },
      demo: [
        { op: 'missing', params: { strategy: 'dropna', cols: ['qty', 'amount'] } },
        { op: 'outlier', params: { mode: 'iqr', col: 'qty' } },
        { op: 'groupby', params: { by: 'category', col: 'amount', how: 'sum' } },
        { op: 'sort', params: { col: 'amount_sum', asc: 'desc' } },
      ],
    },

    /* ------------------------------ 比赛评分 ------------------------------ */
    {
      id: 'scoring',
      icon: '🏅',
      cols: [
        { key: 'contestant', zh: '选手', en: 'Contestant' },
        { key: 'event', zh: '项目', en: 'Event' },
        { key: 'judgeA', zh: '评委A', en: 'JudgeA' },
        { key: 'judgeB', zh: '评委B', en: 'JudgeB' },
        { key: 'judgeC', zh: '评委C', en: 'JudgeC' },
        { key: 'judgeD', zh: '评委D', en: 'JudgeD' },
        { key: 'judgeE', zh: '评委E', en: 'JudgeE' },
        { key: 'difficulty', zh: '难度系数', en: 'Difficulty' },
      ],
      rows: [
        ['沈亦舟', '自由体操', 9.2, 9.4, 9.1, 9.3, 9.3, 1.2],
        ['陆时', '自由体操', 8.8, 9.0, 8.9, 8.7, 9.1, 1.1],
        ['顾川', '跳马', 9.5, 9.3, 9.6, 9.4, 9.5, 1.3],
        ['江雪', '跳马', 8.9, 9.1, 9.0, null, 8.8, 1.1],
        ['白桐', '平衡木', 9.0, 8.8, 9.2, 9.1, 8.9, 1.2],
        ['温砚', '平衡木', 9.6, 9.7, 9.5, 9.6, 9.4, 1.4],
        ['陆时', '跳马', 8.8, 9.0, 8.9, 8.7, 9.1, 1.1],
        ['叶蓁', '自由体操', 9.3, 9.2, 9.4, 9.2, 9.5, 1.2],
        ['顾川', '平衡木', 9.5, 9.3, 9.6, 9.4, 9.5, 1.3],
        ['沈亦舟', '跳马', 9.1, 8.9, 9.2, 9.0, 9.1, 1.2],
        ['江雪', '平衡木', 8.9, 9.1, 9.0, null, 8.8, 1.1],
        ['叶蓁', '跳马', 9.4, 9.5, 9.3, 9.4, 9.2, 1.3],
      ],
      rowsEn: [
        ['Shen Yizhou', 'Floor', 9.2, 9.4, 9.1, 9.3, 9.3, 1.2],
        ['Lu Shi', 'Floor', 8.8, 9.0, 8.9, 8.7, 9.1, 1.1],
        ['Gu Chuan', 'Vault', 9.5, 9.3, 9.6, 9.4, 9.5, 1.3],
        ['Jiang Xue', 'Vault', 8.9, 9.1, 9.0, null, 8.8, 1.1],
        ['Bai Tong', 'Beam', 9.0, 8.8, 9.2, 9.1, 8.9, 1.2],
        ['Wen Yan', 'Beam', 9.6, 9.7, 9.5, 9.6, 9.4, 1.4],
        ['Lu Shi', 'Vault', 8.8, 9.0, 8.9, 8.7, 9.1, 1.1],
        ['Ye Zhen', 'Floor', 9.3, 9.2, 9.4, 9.2, 9.5, 1.2],
        ['Gu Chuan', 'Beam', 9.5, 9.3, 9.6, 9.4, 9.5, 1.3],
        ['Shen Yizhou', 'Vault', 9.1, 8.9, 9.2, 9.0, 9.1, 1.2],
        ['Jiang Xue', 'Beam', 8.9, 9.1, 9.0, null, 8.8, 1.1],
        ['Ye Zhen', 'Vault', 9.4, 9.5, 9.3, 9.4, 9.2, 1.3],
      ],
      lookup: {
        cols: [{ key: 'event', zh: '项目', en: 'Event' }, { key: 'referee', zh: '主裁判', en: 'Head referee' }, { key: 'weight', zh: '权重', en: 'Weight' }],
        rows: [['自由体操', '高鸣', 1.0], ['跳马', '林越', 1.1], ['平衡木', '徐岚', 1.05]],
        rowsEn: [['Floor', 'Gao Ming', 1.0], ['Vault', 'Lin Yue', 1.1], ['Beam', 'Xu Lan', 1.05]],
      },
      extra: {
        rows: [
          ['白桐', '跳马', 9.1, 9.0, 9.2, 8.9, 9.0, 1.2],
          ['温砚', '自由体操', 9.5, 9.6, 9.4, 9.5, 9.7, 1.4],
          ['叶蓁', '平衡木', 9.2, 9.3, 9.1, 9.2, 9.4, 1.2],
        ],
        rowsEn: [
          ['Bai Tong', 'Vault', 9.1, 9.0, 9.2, 8.9, 9.0, 1.2],
          ['Wen Yan', 'Floor', 9.5, 9.6, 9.4, 9.5, 9.7, 1.4],
          ['Ye Zhen', 'Beam', 9.2, 9.3, 9.1, 9.2, 9.4, 1.2],
        ],
      },
      demo: [
        { op: 'missing', params: { strategy: 'fillna', how: 'mean', cols: ['judgeD'] } },
        { op: 'dedupe', params: { cols: ['contestant'] } },
        { op: 'outlier', params: { mode: 'extreme', col: 'judgeA', n: 1 } },
        { op: 'assign', params: { name: '@avg', mode: 'mean', cols: ['judgeA', 'judgeB', 'judgeC', 'judgeD', 'judgeE'] } },
        { op: 'sort', params: { col: 'avg', asc: 'desc' } },
      ],
    },

    /* ------------------------------ 鸢尾花 ------------------------------ */
    {
      id: 'iris',
      icon: '🌸',
      cols: [
        { key: 'sepalL', zh: '花萼长', en: 'Sepal length' },
        { key: 'sepalW', zh: '花萼宽', en: 'Sepal width' },
        { key: 'petalL', zh: '花瓣长', en: 'Petal length' },
        { key: 'petalW', zh: '花瓣宽', en: 'Petal width' },
        { key: 'species', zh: '品种', en: 'Species' },
      ],
      rows: [
        [5.1, 3.5, 1.4, 0.2, 'setosa'], [4.9, 3.0, 1.4, 0.2, 'setosa'], [4.7, 3.2, 1.3, 0.2, 'setosa'],
        [4.6, 3.1, 1.5, 0.2, 'setosa'], [5.0, 3.6, 1.4, 0.2, 'setosa'], [5.4, 3.9, 1.7, 0.4, 'setosa'],
        [4.6, 3.4, 1.4, 0.3, 'setosa'], [5.0, 3.4, 1.5, 0.2, 'setosa'], [4.4, 2.9, 1.4, 0.2, 'setosa'],
        [4.9, 3.1, 1.5, 0.1, 'setosa'], [5.4, 3.7, 1.5, 0.2, 'setosa'], [4.8, 3.4, 1.6, 0.2, 'setosa'],
        [7.0, 3.2, 4.7, 1.4, 'versicolor'], [6.4, 3.2, 4.5, 1.5, 'versicolor'], [6.9, 3.1, 4.9, 1.5, 'versicolor'],
        [5.5, 2.3, 4.0, 1.3, 'versicolor'], [6.5, 2.8, 4.6, 1.5, 'versicolor'], [5.7, 2.8, 4.5, 1.3, 'versicolor'],
        [6.3, 3.3, 4.7, 1.6, 'versicolor'], [4.9, 2.4, 3.3, 1.0, 'versicolor'], [6.6, 2.9, 4.6, 1.3, 'versicolor'],
        [5.2, 2.7, 3.9, 1.4, 'versicolor'], [5.0, 2.0, 3.5, 1.0, 'versicolor'], [5.9, 3.0, 4.2, 1.5, 'versicolor'],
        [6.3, 3.3, 6.0, 2.5, 'virginica'], [5.8, 2.7, 5.1, 1.9, 'virginica'], [7.1, 3.0, 5.9, 2.1, 'virginica'],
        [6.3, 2.9, 5.6, 1.8, 'virginica'], [6.5, 3.0, 5.8, 2.2, 'virginica'], [7.6, 3.0, 6.6, 2.1, 'virginica'],
        [4.9, 2.5, 4.5, 1.7, 'virginica'], [7.3, 2.9, 6.3, 1.8, 'virginica'], [6.7, 2.5, 5.8, 1.8, 'virginica'],
        [7.2, 3.6, 6.1, 2.5, 'virginica'], [6.5, 3.2, 5.1, 2.0, 'virginica'], [6.4, 2.7, 5.3, 1.9, 'virginica'],
      ],
      rowsEn: null,
      lookup: {
        cols: [{ key: 'species', zh: '品种', en: 'Species' }, { key: 'label', zh: '中文名', en: 'Label' }, { key: 'color', zh: '花色', en: 'Colour' }],
        rows: [['setosa', '山鸢尾', '蓝紫'], ['versicolor', '变色鸢尾', '淡紫'], ['virginica', '维吉尼亚鸢尾', '深紫']],
        rowsEn: [['setosa', 'Setosa', 'blue-violet'], ['versicolor', 'Versicolor', 'lilac'], ['virginica', 'Virginica', 'deep purple']],
      },
      extra: {
        rows: [
          [5.8, 4.0, 1.2, 0.2, 'setosa'], [6.0, 2.2, 4.0, 1.0, 'versicolor'], [6.9, 3.1, 5.4, 2.1, 'virginica'],
        ],
        rowsEn: null,
      },
      demo: [
        { op: 'normalize', params: { col: 'petalL', how: 'minmax' } },
        { op: 'corr', params: {} },
        { op: 'groupby', params: { by: 'species', col: 'petalL', how: 'mean' } },
        { op: 'describe', params: {} },
      ],
    },
  ];

  /* ---------------- 构建 ---------------- */
  function colsFor(ds, lang) {
    return ds.cols.map((c) => ({ key: c.key, name: lang === 'en' ? (c.en || c.zh) : (c.zh || c.en) }));
  }
  function rowsFor(ds, lang) {
    return lang === 'en' ? (ds.rowsEn || ds.rows) : ds.rows;
  }

  function build(ds, lang) {
    const df = global.DF.DataFrame.fromColumns(colsFor(ds, lang), rowsFor(ds, lang), { dataset: ds.id });
    df.meta.lookup = ds.lookup || null;
    df.meta.extra = ds.extra || null;
    return df;
  }

  /** 关联表（merge 用） */
  function lookupDF(ds, lang) {
    if (!ds.lookup) return null;
    const cols = ds.lookup.cols.map((c) => ({ key: c.key, name: lang === 'en' ? (c.en || c.zh) : (c.zh || c.en) }));
    const rows = lang === 'en' ? (ds.lookup.rowsEn || ds.lookup.rows) : ds.lookup.rows;
    return global.DF.DataFrame.fromColumns(cols, rows, { dataset: ds.id + '_lookup' });
  }

  global.DATASETS = DATASETS;
  global.Datasets = {
    build, lookupDF, colsFor, rowsFor,
    get(id) { return DATASETS.find((d) => d.id === id) || DATASETS[0]; },
    name(ds, lang) { return global.I18n.t('ds.' + ds.id + '.name'); },
    desc(ds) { return global.I18n.t('ds.' + ds.id + '.desc'); },
  };
})(window);
