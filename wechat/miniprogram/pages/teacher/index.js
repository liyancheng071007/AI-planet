const {stages}=require('../../lib/content');
Page({data:{stages,expanded:false},toggle(){this.setData({expanded:!this.data.expanded});}});
